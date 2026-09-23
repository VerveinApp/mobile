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

import { getDevPremiumOverride } from '@/lib/dev-premium-override';
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

export type BillingMode = 'test-store' | 'production' | 'unconfigured';

/**
 * Which key API_KEY above actually resolved to — surfaced in Settings' own
 * Developer section so it's never ambiguous which backend a build is
 * talking to (the exact confusion that led to a "couldn't load pricing"
 * paywall in the Simulator: the app was silently on the real production key,
 * which can't resolve in Simulator at all).
 */
export function getBillingMode(): BillingMode {
  if (!API_KEY) return 'unconfigured';
  if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY_IOS) return 'test-store';
  return 'production';
}

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
 * The current offering's packages ($rc_monthly/$rc_annual/$rc_lifetime, as
 * configured in RevenueCat) — null if not configured or the fetch fails, so
 * the paywall can show an honest "couldn't load" state instead of an empty
 * screen pretending nothing's wrong.
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
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
 *
 * ⚠️ TEMPORARY: checks dev-premium-override.ts's local, client-side-only
 * override FIRST — see that file's own header comment for what this is and
 * why it must be removed before the real App Store submission. Gated behind
 * __DEV__ so a release bundle (including any TestFlight/App Store build,
 * which is never __DEV__) can never read or honor it regardless of what's
 * sitting in AsyncStorage — same belt-and-suspenders posture as the
 * Developer section in settings/index.tsx that's the only real way to set
 * this override in the first place. Never touches RevenueCat itself, so it
 * can't fake or grant a real purchase.
 */
export async function hasPremiumEntitlement(): Promise<boolean> {
  if (__DEV__ && (await getDevPremiumOverride())) return true;
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
 * to manage: not configured, the dev-premium-override is what's granting
 * access (there's no real subscription behind it to open), or RevenueCat
 * itself reports no management URL (e.g. no active subscription).
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
 * tabs, so flipping the Settings dev-premium-override toggle and returning
 * to an already-visited tab never re-ran this check; it kept showing
 * whatever answer it got the first time that tab was ever opened. Real
 * RevenueCat state can also actually change between visits to the same
 * still-mounted tab (a purchase completing, a subscription expiring), not
 * just the dev override — useFocusEffect (re-checks on mount AND on every
 * return to focus) is correct for both.
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

export type ResetPurchaserResult = 'reset' | 'already-anonymous' | 'not-configured' | 'error';

/**
 * ⚠️ DEV-ONLY — Settings' Developer section, "Reset VerveIn Plus Sub" only.
 *
 * IMPORTANT SCOPE NOTE: this can only ever detach the SDK from its current
 * RevenueCat identity (Purchases.logOut(), RevenueCat's own documented way
 * to test a paywall repeatedly) — it cannot revoke or expire a real
 * entitlement, which only RevenueCat's server-side dashboard/API (gated by a
 * secret key that must never ship in this client bundle) can do. Concretely:
 * a Test Store purchase made under this device's current identity really is
 * granted server-side, tied to that app_user_id (syncIdentityWithSupabaseAuth
 * deliberately keeps that stable = the Supabase user id, so a real install
 * never loses a real purchase) — logOut() only switches to a fresh anonymous
 * id with no purchase history for the REST OF THIS APP SESSION. The next
 * app restart re-runs syncIdentityWithSupabaseAuth's own INITIAL_SESSION
 * handler, which logs back into the same still-signed-in Supabase user id
 * and pulls the same entitlement right back. Good enough for "let me see the
 * paywall/free tier again without restarting"; not a real, permanent
 * revocation — that has to happen in the RevenueCat dashboard itself
 * (Customers → find the subscriber → expire/revoke the entitlement).
 */
export async function resetPurchaserIdentityForTesting(): Promise<ResetPurchaserResult> {
  if (!configured) return 'not-configured';
  try {
    await Purchases.logOut();
    return 'reset';
  } catch (error) {
    const code = (error as { code?: PURCHASES_ERROR_CODE })?.code;
    if (code === PURCHASES_ERROR_CODE.LOG_OUT_ANONYMOUS_USER_ERROR) return 'already-anonymous';
    return 'error';
  }
}
