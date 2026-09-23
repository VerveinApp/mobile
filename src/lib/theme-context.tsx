import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme-preference';

type ResolvedScheme = 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  colors: Record<keyof typeof Colors.dark, string>;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Wraps the whole app (see _layout.tsx). Resolves the user's stored
 * System/Light/Dark preference against the device's own color scheme when
 * set to "system" — everything else in the app reads the result via
 * useAppColors()/useAppTheme() instead of touching AsyncStorage or
 * useColorScheme() directly.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setPreferenceState(await getThemePreference());
      setLoaded(true);
    })();
  }, []);

  // BUG FIX: the in-app choice only ever reached React-drawn UI — the
  // status bar, keyboard, system alerts, action/share sheets and the native
  // tab bar all kept following the DEVICE setting. Picking Light on a phone
  // in dark mode left white status-bar text on a light-gray page (invisible)
  // and a dark keyboard over light screens. Overriding the app-level
  // appearance makes every native surface follow the same choice; 'system'
  // hands control back to the OS ('unspecified').
  useEffect(() => {
    if (!loaded || Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [loaded, preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    setThemePreference(next);
  };

  const resolvedScheme: ResolvedScheme =
    preference === 'system' ? (deviceScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedScheme, colors: Colors[resolvedScheme], setPreference }),
    [preference, resolvedScheme]
  );

  // BUG FIX: children used to render before the stored preference loaded,
  // resolving 'system' against the device for a frame or two — anyone who
  // picked a theme different from their phone's saw the whole app flip
  // right after launch. Holding render for this one AsyncStorage read keeps
  // the native splash up instead (it only hides once the first real frame
  // lays out — see AnimatedSplashOverlay), so the first frame is already
  // the right theme.
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
}

export function useAppColors() {
  return useAppTheme().colors;
}
