import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { hasCompletedOnboarding, loadOnboardingDraft, ONBOARDING_STEP_ROUTES } from '@/lib/onboarding-draft';

/**
 * The app's actual entry point. Onboarding now runs before any account
 * exists, so this "Home" tab is a router, not a screen: a first-time user
 * lands in onboarding, someone mid-flow resumes where they left off, and
 * only a user who has actually finished onboarding sees real content here.
 *
 * There's no backend/session system yet, so "hasCompletedOnboarding" is a
 * local flag, not a real auth check — see markOnboardingComplete in
 * onboarding-draft.ts. Replacing this with a real authenticated Home is
 * separate, later work.
 */
export default function HomeEntryScreen() {
  const [status, setStatus] = useState<'checking' | 'home'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const completed = await hasCompletedOnboarding();
      if (cancelled) return;
      if (completed) {
        setStatus('home');
        return;
      }
      const draft = await loadOnboardingDraft();
      if (cancelled) return;
      if (draft) {
        router.replace({ pathname: ONBOARDING_STEP_ROUTES[draft.step], params: draft.params } as never);
        return;
      }
      router.replace('/onboarding' as never);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status !== 'home') return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>You're all set</Text>
      <Text style={styles.subtitle}>Home is coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System',
  },
  subtitle: {
    marginTop: 8,
    color: '#9a9a9a',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'System',
  },
});
