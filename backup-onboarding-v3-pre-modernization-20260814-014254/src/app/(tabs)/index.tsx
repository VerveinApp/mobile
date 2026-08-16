import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';

/**
 * The app's actual entry point. Onboarding now runs before any account
 * exists, so this "Home" tab is a router, not a screen: a first-time user
 * lands in onboarding, someone mid-flow resumes where they left off, and
 * a user who has finished onboarding lands on home/check-in.
 *
 * There's no backend/session system yet, so "hasCompletedOnboarding" is a
 * local flag, not a real auth check — see markOnboardingComplete in
 * onboarding-draft.ts. home/check-in is itself a placeholder (TEMPORARY —
 * see its own file comment) standing in for the real Home until that's
 * built; this redirect will need to move to wherever Home actually lives.
 */
export default function HomeEntryScreen() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const completed = await hasCompletedOnboarding();
      if (cancelled) return;
      if (completed) {
        router.replace('/home/check-in' as never);
        return;
      }
      const draft = await loadOnboardingDraft();
      if (cancelled) return;
      if (draft) {
        router.replace({ pathname: ONBOARDING_STEP_ROUTES[draft.step], params: draft.params } as never);
        return;
      }
      router.replace('/onboarding/welcome' as never);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
