import { router } from 'expo-router';
import { useEffect } from 'react';

import { markOnboardingComplete } from '@/lib/onboarding-draft';
import { saveProfile, withHealthConsent } from '@/lib/user-profile';

/**
 * E2E-test-only backdoor: seeds a complete, valid local profile and marks
 * onboarding done, then drops straight into the main tabs — letting Maestro
 * flows reach an already-onboarded state without a real email OTP or
 * Apple/Google sign-in, neither of which CI can perform (see
 * .maestro/tab-navigation.yaml's own header comment).
 *
 * Compiled dead in every real build: EXPO_PUBLIC_E2E_SEED_ENABLED is only
 * ever set to '1' in .github/workflows/maestro.yml's own "Write .env.local"
 * step, never in .env.example or any production config, and this value is
 * inlined into the JS bundle at build time (same as every other
 * EXPO_PUBLIC_* var) — not something a deep link's own params can toggle at
 * runtime. Reaching this route anywhere else (a real App Store build, or
 * local dev unless a developer explicitly opts in) is a silent no-op back
 * to the real Welcome screen.
 */
// check-in.tsx/train.tsx's own `isRestDay` reads WEEKDAY_NAMES[new
// Date().getDay()] against this profile's `days` — a fixed
// 'monday,wednesday,friday' meant every flow relying on "today lands on
// Rest Day" (rest-day-checkin.yaml, exercise-swap-sheet.yaml's own
// deliberate rest-day-override path) only actually worked on 4 of 7 real
// calendar days, and silently failed with an unrelated-looking error
// ("Tap on 'Check in anyway'... FAILED", no "Check in anyway" link exists
// on a real scheduled training day) whenever CI happened to run on a
// Monday, Wednesday, or Friday — confirmed against CI run 33822805317,
// which executed on 2026-09-04, a real Friday. Computed relative to
// whatever day the test actually runs on instead: three days offset from
// today by 1/2/3 (mod 7), which by construction can never include today
// itself, so "today is a rest day" is true every real calendar day this
// ever runs, not just some of them.
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function trainingDaysExcludingToday(): string {
  const todayIndex = new Date().getDay();
  return [1, 2, 3].map((offset) => WEEKDAY_NAMES[(todayIndex + offset) % 7]).join(',');
}

export default function E2ESeedScreen() {
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_E2E_SEED_ENABLED !== '1') {
      router.replace('/');
      return;
    }
    (async () => {
      await saveProfile({
        name: 'Test User',
        email: 'e2e-test@vervein.app',
        goal: 'get-stronger',
        experience: 'trained-before',
        environment: 'full-gym',
        duration: '45-60',
        commitmentLevel: '4',
        days: trainingDaysExcludingToday(),
        // progress-photo-add.yaml reaches a healthConsent-gated screen
        // (settings/progress-photos.tsx) — without this the seeded account
        // would hit HealthConsentGate instead of the real screen content.
        ...withHealthConsent('true'),
      });
      await markOnboardingComplete();
      router.replace('/(tabs)');
    })();
  }, []);

  return null;
}
