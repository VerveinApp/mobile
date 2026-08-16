import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
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

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
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
        <Stack.Screen name="onboarding/step-8" />
        <Stack.Screen name="onboarding/step-9" />
        <Stack.Screen name="onboarding/first-look" />
        <Stack.Screen name="onboarding/potential" />
        <Stack.Screen name="onboarding/create-account" />
        <Stack.Screen name="onboarding/all-set" />
        <Stack.Screen name="home/check-in" />
      </Stack>
    </ThemeProvider>
  );
}
