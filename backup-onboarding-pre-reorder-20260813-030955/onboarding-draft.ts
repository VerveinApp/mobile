import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = 'vervein.onboardingDraft.v1';

/** Onboarding step screens that can be resumed after the name-entry screen. */
export const ONBOARDING_STEP_ROUTES: Record<number, string> = {
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-4',
  5: '/onboarding/step-5',
  6: '/onboarding/step-6',
  7: '/onboarding/step-7',
  8: '/onboarding/step-8',
};

export type OnboardingDraft = {
  /** The step the user should resume at (2–8 — see ONBOARDING_STEP_ROUTES). */
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
