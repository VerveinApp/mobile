import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { supabase } from '@/lib/supabase';

// iOS-only for now, same scoping as health-kit.ts — this app doesn't ship
// Android yet. The Test Store key below is sandbox-only (no real store
// connected in RevenueCat yet); swap for the real Apple key once RevenueCat's
// iOS app configuration + real App Store Connect subscription products exist.
// See .env.local's own comment on this key.
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;

// Matches the entitlement identifier configured in the RevenueCat dashboard
// exactly (including the space) — VerveIn Plus, not a slug. RevenueCat
// entitlement identifiers are arbitrary strings, not required to be
// slug-cased.
export const PREMIUM_ENTITLEMENT_ID = 'VerveIn Plus';

let configured = false;

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
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user.id) {
      Purchases.logIn(session.user.id).catch(() => {});
    } else if (event === 'SIGNED_OUT') {
      Purchases.logOut().catch(() => {});
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
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[PREMIUM_ENTITLEMENT_ID]?.isActive === true;
  } catch {
    return false;
  }
}

/**
 * Convenience hook for gating a screen's Plus-only sections. Null while the
 * initial check is in flight, distinct from `false` — lets a caller show a
 * neutral loading state instead of flashing the locked teaser for a moment
 * on every screen focus before the real (often already-true) answer lands.
 * Re-checks on every mount rather than caching across the app's lifetime —
 * cheap (the SDK's own CustomerInfo cache backs this), and correct the
 * instant a purchase completes in the very same session (the paywall
 * screen's own success path calls router.back(), remounting whatever gated
 * section sent the user there).
 */
export function usePremiumEntitlement(): boolean | null {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    hasPremiumEntitlement().then((value) => {
      if (!cancelled) setIsPremium(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
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
    const isActive = info.entitlements.active[PREMIUM_ENTITLEMENT_ID]?.isActive === true;
    return isActive ? { kind: 'restored' } : { kind: 'none' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't restore purchases right now.";
    return { kind: 'error', message };
  }
}
