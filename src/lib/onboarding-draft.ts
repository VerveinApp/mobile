import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateStr } from '@/lib/local-date';

const DRAFT_KEY = 'vervein.onboardingDraft.v1';
const COMPLETED_KEY = 'vervein.onboardingCompleted.v1';
const START_DATE_KEY = 'vervein.accountStartDate.v1';

/**
 * Onboarding step screens that can be resumed after the name-entry screen.
 * step-5 is Consent+Biometrics merged, step-6 is Duration+Days merged —
 * what used to be four screens (old step-5/6/7/8) is now two, which is why
 * this map skips straight from 6 to 7 (Commitment, moved from the old
 * step-9) with no gap.
 */
export const ONBOARDING_STEP_ROUTES: Record<number, string> = {
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-4',
  5: '/onboarding/step-5',
  6: '/onboarding/step-6',
  7: '/onboarding/step-7',
  8: '/onboarding/first-look',
  9: '/onboarding/create-account',
  // 10 (onboarding/potential.tsx, the consent-branch "estimated potential"
  // payoff — % score + trajectory bars) was cut: scoring a fluctuating-
  // capacity user against an ideal is exactly the performance-guilt frame
  // this product exists to reject. Both branches converge on 8 now. A stale
  // draft saved with step 10 before this change resolves to no route,
  // which loadOnboardingDraft() already treats as "no draft" — the user
  // just restarts onboarding cleanly, never a crash.
};

export type OnboardingDraft = {
  /** The step the user should resume at (2–9 — see ONBOARDING_STEP_ROUTES). */
  step: number;
  params: Record<string, string>;
};

/**
 * Best-effort local draft of in-progress onboarding answers. Everything else
 * in this flow rides forward as route params only — if the app is
 * backgrounded and killed mid-onboarding, those params are gone and the user
 * restarts from scratch. This mirrors the same accumulated params into
 * storage on every step transition so a relaunch can resume instead.
 */
export async function saveOnboardingDraft(draft: OnboardingDraft) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Losing the draft just means no resume, not a crash.
  }
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!ONBOARDING_STEP_ROUTES[parsed.step]) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do — worst case a stale draft lingers and gets overwritten next time.
  }
}

/**
 * Marks onboarding as durably finished, distinct from the in-progress draft.
 * There's no real backend/session system yet — this is a local stand-in for
 * "this device has a completed profile" so the app's entry point ((tabs)/index.tsx)
 * doesn't loop a just-signed-up user back into onboarding.
 */
export async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(COMPLETED_KEY, 'true');
    await AsyncStorage.removeItem(DRAFT_KEY);
    // Only ever set once per "generation" of this account on this device
    // (cleared alongside COMPLETED_KEY by clearOnboardingCompleted below) —
    // see getAccountStartDate's own doc comment for what this fixes.
    const existing = await AsyncStorage.getItem(START_DATE_KEY);
    if (!existing) await AsyncStorage.setItem(START_DATE_KEY, localDateStr());
  } catch {
    // Worst case the entry redirect re-checks and finds no flag — same as never having called this.
  }
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(COMPLETED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * The local YYYY-MM-DD this device's account first finished onboarding —
 * used by session-history.ts to stop treating calendar days from BEFORE the
 * account existed as "missed." getWeekActivity/getRecentWeeks used to
 * compute a missed day purely from scheduledDays' recurring weekly pattern
 * projected across the calendar, with no floor: a brand-new account created
 * on a Friday whose weekly pattern includes Monday–Thursday saw those same-
 * week days rendered as missed red dots, despite the account (and its plan)
 * not existing yet on any of them. Null only if onboarding was never
 * completed on this device at all (shouldn't be reachable from a screen
 * that's already past onboarding, but never assumed).
 *
 * BUG FIX: this only got set going forward (inside markOnboardingComplete),
 * so an account that finished onboarding before this field existed had no
 * way to ever pick one up — it would read null forever, silently falling
 * back to the old, buggy "exclude nothing" behavior permanently, on the
 * exact accounts most likely to still be showing the bug being fixed.
 * Self-heals here instead: the first time this is read with onboarding
 * already complete but no start date on file, today becomes that date.
 * This can't know the account's TRUE original start day, but "today" is the
 * safe direction to guess — it only ever excludes days from here forward
 * from being wrongly treated as pre-existing history, never the reverse.
 */
export async function getAccountStartDate(): Promise<string | null> {
  try {
    const existing = await AsyncStorage.getItem(START_DATE_KEY);
    if (existing) return existing;
    if ((await AsyncStorage.getItem(COMPLETED_KEY)) !== 'true') return null;
    const backfilled = localDateStr();
    await AsyncStorage.setItem(START_DATE_KEY, backfilled);
    return backfilled;
  } catch {
    return null;
  }
}


/**
 * Puts back a completed onboarding exactly as it was, original start date
 * included — account-switch.ts uses this when an account's set-aside data
 * returns to this device, so its week history doesn't restart "today" the
 * way a fresh markOnboardingComplete() would.
 */
export async function restoreOnboardingCompleted(startDate: string | null) {
  try {
    await AsyncStorage.setItem(COMPLETED_KEY, 'true');
    if (startDate) await AsyncStorage.setItem(START_DATE_KEY, startDate);
  } catch {
    // Worst case the start date backfills to today — see getAccountStartDate.
  }
}

/** Un-does markOnboardingComplete — used by Profile's "Reset & Restart" action. */
export async function clearOnboardingCompleted() {
  try {
    await AsyncStorage.removeItem(COMPLETED_KEY);
    await AsyncStorage.removeItem(START_DATE_KEY);
  } catch {
    // Best-effort — same as never having completed onboarding.
  }
}

// BUG FIX (removed): this file used to also export savePendingVerifiedEmail/
// takePendingVerifiedEmail — a device-wide AsyncStorage flag (with a
// 30-minute TTL) that let auth/verify.tsx's bare "Sign in" branch skip
// re-verifying an email once the user reached create-account.tsx a second
// time. A global, time-based flag couldn't distinguish "the same in-progress
// onboarding chain that set it" from "a different, unrelated 'Get Started'
// attempt on the same device a few minutes later" — reachable on any shared/
// family device, and silent when it happened (the second person's own
// answers would get bound to the first person's already-verified email,
// with no email form ever shown). Replaced with an ordinary `verifiedEmail`
// route param threaded through onboarding/index.tsx → step-2..7 → first-look
// → create-account.tsx, the same way every other onboarding answer already
// rides forward — a route param can't leak across unrelated navigation
// chains the way a global flag could, which is what actually closes this.
