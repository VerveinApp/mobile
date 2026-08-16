import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

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
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setPreferenceState(await getThemePreference());
      setLoaded(true);
    })();
  }, []);

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

  // Loading the stored preference is fast (one AsyncStorage read) and the
  // default ('dark') matches every screen's current hardcoded look, so
  // there's no blank/flash frame to guard against here — children render
  // immediately with the default and re-render once if it turns out to be
  // something else.
  void loaded;

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
