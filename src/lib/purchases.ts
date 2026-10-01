import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import * as Sentry from '@sentry/react-native';

import { supabase } from '@/lib/supabase';

// iOS-only for now, same scoping as health-kit.ts — this app doesn't ship
// Android yet. EXPO_PUBLIC_REVENUECAT_API_KEY_IOS is the real key, wired to
// the real App Store Connect app (see .env.local's own comment) — that
// never resolves real offerings/pricing in the Simulator, since Simulator
// can't talk to real StoreKit. __DEV__ builds use the separate Test Store
// key instead: a RevenueCat-hosted mock app with its own fake products, so
// pricing/purchases work in Simulator (and on device) without ever touching
// the real store. Falls back to the real key if the Test Store one isn't
// set, so an unconfigured dev env fails the same honest way it always did
// rather than silently picking undefined.
const API_KEY = __DEV__
  ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY_IOS || process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
  : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;

// Matches the entitlement identifier configured in the RevenueCat dashboard
// exactly (including the space) — VerveIn Plus, not a slug. RevenueCat
// entitlement identifiers are arbitrary strings, not required to be
// slug-cased.
export const PREMIUM_ENTITLEMENT_ID = 'VerveIn Plus';

let configured = false;

// ---------------------------------------------------------------------------
// One shared, live view of the entitlement — see usePremiumEntitlement.
// ---------------------------------------------------------------------------

function isEntitled(info: CustomerInfo): boolean {
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID]?.isActive === true;
}

/** The last real answer any check produced, so a screen mounting later
 * starts from it instead of from "unknown" (and its locked-teaser pop-in). */
let lastKnownEntitlement: boolean | null = null;
const entitlementListeners = new Set<(value: boolean) => void>();

function publishEntitlement(value: boolean): void {
  lastKnownEntitlement = value;
  entitlementListeners.forEach((listener) => listener(value));
}

// Resolves once RevenueCat has been told who the signed-in user is (or that
// nobody is). BUG FIX: logIn used to be fire-and-forget, so the first
// entitlement check on a cold launch could read the ANONYMOUS RevenueCat
// user — a paying subscriber saw every Plus section locked until they
// switched screens. Checks now wait for identity first (bounded, so a hung
// network call can't block them forever).
let identityReady: Promise<void> = Promise.resolve();
const IDENTITY_WAIT_MAX_MS = 5000;

/**
 * Call once at app startup (see _layout.tsx). Safe to call more than once —
 * short-circuits after the first real call, same idempotency guard
 * onboarding-draft.ts and other one-time-setup lib functions already use.
 * Silently no-ops on a platform other than iOS or when the API key isn't
 * set, rather than throwing — the rest of this file's functions already
 * treat "not configured" as the honest default (no entitlement, no
 * offerings) instead of crashing a screen that merely checks premium status.
 */
export async function initPurchases(): Promise<void> {
  if (configured || Platform.OS !== 'ios' || !API_KEY) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
    syncIdentityWithSupabaseAuth();
    // Purchases, restores, renewals and expirations all arrive here — every
    // mounted screen's gate updates the moment it happens, not on its next
    // focus.
    Purchases.addCustomerInfoUpdateListener((info) => publishEntitlement(isEntitled(info)));
  } catch {
    // Worst case Premium features stay locked this session — never a crash,
    // same "under-triggering is the safe failure mode" rule health-kit.ts
    // already follows for its own optional integration.
  }
}

/**
 * Keeps RevenueCat's app_user_id equal to the signed-in Supabase user id
 * instead of RevenueCat's own anonymous device ID. Without this, a
 * server-side action keyed on the Supabase user (e.g. a referral reward)
 * has no reliable RevenueCat subscriber to grant an entitlement to — the
 * anonymous ID isn't known outside this device until identified like this.
 * `onAuthStateChange`'s own first callback fires with `INITIAL_SESSION`
 * (the session that already existed at launch, if any), so this alone
 * covers both "already signed in" and "signs in later" without a separate
 * getSession() call. Errors are swallowed — same "never crash a screen that
 * merely checks premium status" posture as the rest of this file; worst
 * case a referral reward would need a manual identity fix later, not a
 * broken app right now.
 */
function syncIdentityWithSupabaseAuth(): void {
  let markIdentityReady: () => void = () => {};
  identityReady = new Promise<void>((resolve) => {
    markIdentityReady = resolve;
    setTimeout(resolve, IDENTITY_WAIT_MAX_MS);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user.id) {
      Purchases.logIn(session.user.id)
        .then(({ customerInfo }) => publishEntitlement(isEntitled(customerInfo)))
        .catch(() => {})
        .finally(markIdentityReady);
    } else if (event === 'INITIAL_SESSION') {
      markIdentityReady();
    } else if (event === 'SIGNED_OUT') {
      Purchases.logOut()
        .then((customerInfo) => publishEntitlement(isEntitled(customerInfo)))
        .catch(() => {});
    }
  });
}

/**
 * Why plans didn't load, in the terms the paywall can act on:
 * - offline: no connection — it'll work once one is back.
 * - store: the App Store was slow or had a problem — worth another try.
 * - unavailable: RevenueCat or App Store Connect returned nothing to sell
 *   (no current offering, no products attached, products not approved, the
 *   Paid Apps agreement…). Retrying won't fix it, and the connection isn't
 *   the cause, so the paywall must not say it is.
 */
export type PlansFailure = 'offline' | 'store' | 'unavailable';

export type PlansResult =
  | { kind: 'ready'; offering: PurchasesOffering; packages: PurchasesPackage[] }
  | { kind: 'failed'; reason: PlansFailure };

const OFFLINE_ERROR_CODES: readonly string[] = [
  PURCHASES_ERROR_CODE.NETWORK_ERROR,
  PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR,
];
const STORE_ERROR_CODES: readonly string[] = [
  PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
  PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR,
];

/**
 * The current offering's packages, in display order — the monthly/annual/
 * lifetime shortcuts ($rc_monthly/$rc_annual/$rc_lifetime, as configured in
 * RevenueCat), or every available package if the offering uses custom ones.
 *
 * BUG FIX: this used to be getCurrentOffering(), which swallowed the error
 * and returned null for every failure, so the paywall blamed "your
 * connection" even when RevenueCat was reporting a configuration problem —
 * and nobody could see which one it was. The real error code now reaches
 * the device log (Console.app, filter "[paywall]") and Sentry, and the
 * reason reaches the paywall.
 */
export async function loadPlans(): Promise<PlansResult> {
  if (!configured) {
    reportPlansFailure('not-configured');
    return { kind: 'failed', reason: 'unavailable' };
  }
  try {
    const { current } = await Purchases.getOfferings();
    if (!current) {
      reportPlansFailure('no-current-offering');
      return { kind: 'failed', reason: 'unavailable' };
    }
    const shortcuts = [current.monthly, current.annual, current.lifetime].filter(
      // Loose inequality on purpose — an absent package type comes back as
      // undefined at runtime, not the null the SDK's types declare.
      (p): p is PurchasesPackage => p != null
    );
    const packages = shortcuts.length > 0 ? shortcuts : current.availablePackages;
    if (packages.length === 0) {
      reportPlansFailure('empty-offering');
      return { kind: 'failed', reason: 'unavailable' };
    }
    return { kind: 'ready', offering: current, packages };
  } catch (error) {
    const { code } = (error ?? {}) as { code?: string };
    reportPlansFailure(code ?? 'unknown', describePurchasesError(error));
    if (code && OFFLINE_ERROR_CODES.includes(code)) return { kind: 'failed', reason: 'offline' };
    if (code && STORE_ERROR_CODES.includes(code)) return { kind: 'failed', reason: 'store' };
    return { kind: 'failed', reason: 'unavailable' };
  }
}

type PurchasesErrorShape = {
  message?: string;
  userInfo?: {
    readableErrorCode?: string;
    underlyingErrorMessage?: string;
    NSUnderlyingError?: { code?: string; domain?: string; userInfo?: { NSLocalizedDescription?: string } };
  };
};

/**
 * The parts of a RevenueCat rejection that say what actually went wrong, in
 * the shape the native bridge really sends: on iOS the NSError's userInfo
 * (readableErrorCode, and NSUnderlyingError for the StoreKit/network/backend
 * cause), on Android userInfo.underlyingErrorMessage. The message itself
 * already names the configuration cause (missing products and the like).
 * Never the whole userInfo — the nested error carries native stack arrays.
 */
function describePurchasesError(error: unknown): string | undefined {
  const { message, userInfo } = (error ?? {}) as PurchasesErrorShape;
  const underlying = userInfo?.NSUnderlyingError;
  const parts = [
    userInfo?.readableErrorCode,
    message,
    underlying
      ? `underlying ${underlying.domain ?? 'error'} ${underlying.code ?? ''}${underlying.userInfo?.NSLocalizedDescription ? `: ${underlying.userInfo.NSLocalizedDescription}` : ''}`.trim()
      : userInfo?.underlyingErrorMessage,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' — ') : undefined;
}

function reportPlansFailure(code: string, detail?: string): void {
  console.warn(`[paywall] plans failed to load: ${code}${detail ? ` — ${detail}` : ''}`);
  Sentry.captureMessage('Paywall plans failed to load', {
    level: 'warning',
    tags: { area: 'paywall-plans', code },
    extra: detail ? { detail } : undefined,
  });
}

/**
 * Which products this Apple ID can still get an intro offer (free trial) on.
 * Apple only grants one intro offer per subscription group, so someone who
 * already used a trial must never see "Start Free Trial" — tapping it would
 * charge them immediately. Anything other than a definite ELIGIBLE (including
 * UNKNOWN, which RevenueCat's own docs say to treat as "show regular
 * pricing") comes back false, as does any failure: under-promising a trial
 * is the safe failure mode, advertising one that won't happen is not.
 */
export async function getIntroOfferEligibility(productIdentifiers: string[]): Promise<Record<string, boolean>> {
  if (!configured || productIdentifiers.length === 0) return {};
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIdentifiers);
    const eligibility: Record<string, boolean> = {};
    for (const id of productIdentifiers) {
      eligibility[id] = result[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    }
    return eligibility;
  } catch {
    return {};
  }
}

/**
 * Real, live entitlement check — never cached separately from what the SDK
 * itself already caches, so this can't drift from the actual purchase state
 * the way a second AsyncStorage-backed copy could after an expiration or a
 * refund RevenueCat's own webhook already knows about but a stale local copy
 * wouldn't. False (not an error) when not configured — an unconfigured
 * (e.g. non-iOS) build should read as "no Premium," not crash every gated
 * screen.
 */
export async function hasPremiumEntitlement(): Promise<boolean> {
  if (!configured) return false;
  await identityReady;
  try {
    return isEntitled(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

/**
 * The store's own subscription-management page (App Store or Play Store,
 * whichever the active subscription is actually on) — RevenueCat's
 * `CustomerInfo.managementURL` already resolves to the right one, so this
 * doesn't need its own platform branch. Null whenever there's nothing real
 * to manage: not configured, or RevenueCat itself reports no management URL
 * (e.g. no active subscription).
 */
export async function getSubscriptionManagementUrl(): Promise<string | null> {
  if (!configured) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.managementURL;
  } catch {
    return null;
  }
}

/**
 * Convenience hook for gating a screen's Plus-only sections. Null while the
 * initial check is in flight, distinct from `false` — lets a caller show a
 * neutral loading state instead of flashing the locked teaser for a moment
 * on every screen focus before the real (often already-true) answer lands.
 *
 * BUG FIX: this used to re-check only on mount (a plain useEffect with an
 * empty dependency array), not on every focus. That's correct for a screen
 * that's genuinely remounted after a purchase (the paywall's own success
 * path calls router.back(), remounting whatever gated section sent the user
 * there) — but a tab screen stays mounted in the background when you switch
 * tabs, so returning to an already-visited tab never re-ran this check; it
 * kept showing whatever answer it got the first time that tab was ever
 * opened, even though RevenueCat state can change between visits (a purchase
 * completing, a subscription expiring) — useFocusEffect re-checks on mount
 * AND on every return to focus.
 */
export function usePremiumEntitlement(): boolean | null {
  // Starts from the last real answer (see lastKnownEntitlement) — only the
  // very first check of an app launch is ever "unknown" now.
  const [isPremium, setIsPremium] = useState<boolean | null>(lastKnownEntitlement);
  useEffect(() => {
    entitlementListeners.add(setIsPremium);
    return () => {
      entitlementListeners.delete(setIsPremium);
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      hasPremiumEntitlement().then((value) => {
        if (cancelled) return;
        lastKnownEntitlement = value;
        setIsPremium(value);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return isPremium;
}

export type PurchaseOutcome =
  | { kind: 'purchased'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Wraps Purchases.purchasePackage — cancellation is a real, common, honest
 * outcome (someone backing out of the system sheet), never surfaced as an
 * error the paywall would show a scary message for. Every other failure
 * still reaches the caller as a real message rather than a silent no-op,
 * since a payment failing IS something the user needs to know about, unlike
 * the read-only checks above where silence is the safe default.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: 'purchased', customerInfo };
  } catch (error) {
    const code = (error as { code?: PURCHASES_ERROR_CODE })?.code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
    const message = error instanceof Error ? error.message : 'Something went wrong with the purchase.';
    return { kind: 'error', message };
  }
}

export type RestoreOutcome =
  | { kind: 'restored' }
  | { kind: 'none' }
  | { kind: 'error'; message: string };

/**
 * "Restore Purchases" — App Store review requires this exact affordance
 * (not just automatic restoration) for any paywall, so it's exposed as its
 * own function rather than folded into hasPremiumEntitlement above, which
 * intentionally never triggers a real restore call on its own.
 *
 * Three real outcomes, not a bare boolean — a network/server error used to
 * collapse into the same `false` as "the call succeeded and genuinely found
 * nothing," which meant the paywall always said "No active purchase found
 * for this account" even when the real cause was connectivity, with no way
 * to tell the difference or retry.
 */
export async function restorePurchases(): Promise<RestoreOutcome> {
  try {
    const info = await Purchases.restorePurchases();
    const isActive = isEntitled(info);
    publishEntitlement(isActive);
    return isActive ? { kind: 'restored' } : { kind: 'none' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't restore purchases right now.";
    return { kind: 'error', message };
  }
}
