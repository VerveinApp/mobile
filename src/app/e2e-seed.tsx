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
        days: 'monday,wednesday,friday',
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
