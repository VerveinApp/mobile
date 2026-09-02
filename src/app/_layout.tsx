import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/offline-banner';
import { AppLockGate } from '@/components/security/app-lock-gate';
import { initPurchases } from '@/lib/purchases';
import { refreshSessionReminders } from '@/lib/session-reminders';
import { AppThemeProvider, useAppTheme } from '@/lib/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Geist app-wide (every text style, not just buttons) — the logo is a
  // vector graphic, not a font glyph, so it's unaffected. Gating on this
  // keeps the native splash up (already held by preventAutoHideAsync above)
  // until every weight is ready, so no screen ever flashes system font first.
  const [fontsLoaded] = useFonts({
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
    'Geist-Black': require('../assets/fonts/Geist-Black.ttf'),
  });

  // Fire-and-forget, same as every other optional-integration init in this
  // app (health-kit.ts has no equivalent call — it inits lazily per-call
  // instead — but RevenueCat's own SDK requires one explicit configure()
  // before any other method works, so this has to run once, early, unlike
  // that pattern). Safe this early: initPurchases no-ops without throwing if
  // the API key or platform isn't right, per its own doc comment.
  useEffect(() => {
    initPurchases();
  }, []);

  // Smart-reminder foreground refresh (Vervein addition — see session-
  // reminders.ts's own header comment for why this has to run here, at the
  // app root, rather than in a background task: local-notification content
  // is frozen at scheduling time, so the only reliable way to keep it
  // reasonably fresh is to recompute it every time the app is actually
  // opened. refreshSessionReminders no-ops immediately if reminders are
  // off and throttles itself to once per real day, so this is cheap to
  // call on every cold start and every return to foreground.
  useEffect(() => {
    refreshSessionReminders();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshSessionReminders();
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    // Required by react-native-gesture-handler for any GestureDetector to
    // receive touches at all (EnergyGauge's drag, CommitmentDial's drag) —
    // separate from whatever the Stack navigator handles internally for its
    // own swipe-back gesture.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Wraps everything below, including AppThemeProvider itself — a
          fallback that depended on app theme/state would never catch an
          error IN that state (see error-boundary.tsx's own doc comment). */}
      <ErrorBoundary>
        <AppThemeProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
          </BottomSheetModalProvider>
        </AppThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { resolvedScheme } = useAppTheme();

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <View style={{ flex: 1 }}>
        {/* The (tabs) group owns the bottom tab bar (Home/Explore). Auth screens like
            auth/verify are plain stack screens on top of it — not tabs — so they're
            reachable via router.push()/back() without appearing in the tab bar.

            `slide_from_right` is the native iOS push/pop transition — forward
            navigation slides the new screen in from the right, back navigation
            (via goBack() in src/lib/onboarding-nav.ts, not router.back() —
            see that file) reverses it, and it's gesture-driven: an edge swipe
            goes back exactly like the rest of iOS. This is deliberately the
            same direction as the onboarding flow's own forward progression, per
            the "directionality should match navigation structure" principle —
            a linear step-by-step flow reads as horizontal motion. Each screen's
            own useFadeInEntering() content fade still layers on top. */}
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/verify" />
          <Stack.Screen name="onboarding/welcome" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="onboarding/step-2" />
          <Stack.Screen name="onboarding/step-3" />
          <Stack.Screen name="onboarding/step-4" />
          <Stack.Screen name="onboarding/step-5" />
          <Stack.Screen name="onboarding/step-6" />
          <Stack.Screen name="onboarding/step-7" />
          <Stack.Screen name="onboarding/first-look" />
          <Stack.Screen name="onboarding/create-account" />
          <Stack.Screen name="onboarding/all-set" />
          <Stack.Screen name="onboarding/trajectory" />
          <Stack.Screen name="home/check-in" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/progress-history" />
          <Stack.Screen name="settings/weight-history" />
          <Stack.Screen name="settings/body-measurements" />
          <Stack.Screen name="settings/condition-log" />
          <Stack.Screen name="settings/progress-photos" />
          <Stack.Screen name="log" />
          <Stack.Screen name="notes/index" />
          <Stack.Screen name="notes/[id]" />
          <Stack.Screen name="referral" />
          <Stack.Screen name="legal/terms" />
          <Stack.Screen name="legal/privacy" />
          {/* A real interruption (either the third-check-in trigger or a
              manual Settings visit), not a forward step in any flow — modal
              presentation + slide-from-bottom reads as "something popped up
              on top," distinct from the rest of the app's slide_from_right
              push navigation. */}
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
        <AppLockGate />
        <OfflineBanner />
      </View>
    </ThemeProvider>
  );
}
