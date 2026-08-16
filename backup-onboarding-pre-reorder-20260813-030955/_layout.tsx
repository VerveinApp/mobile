import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {/* The (tabs) group owns the bottom tab bar (Home/Explore). Auth screens like
          auth/verify are plain stack screens on top of it — not tabs — so they're
          reachable via router.push()/back() without appearing in the tab bar.

          `animation: 'none'` disables native-stack's own transition for these
          screens: the quick fade-in is instead driven entirely by
          useFadeInEntering() in src/lib/screen-transitions.ts. Any future
          onboarding screen should use the same hook to stay consistent with
          this motion language. */}
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/verify" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/step-2" />
        <Stack.Screen name="onboarding/step-3" />
        <Stack.Screen name="onboarding/step-4" />
        <Stack.Screen name="onboarding/step-5" />
        <Stack.Screen name="onboarding/step-6" />
        <Stack.Screen name="onboarding/step-7" />
      </Stack>
    </ThemeProvider>
  );
}
