import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.themePreference.v1';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Defaults to following the device's OS appearance — every real screen now
 * reads its colors from the theme system (see constants/theme.ts), so there's
 * no longer a dark-only baseline to protect a new install against. */
export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
}

export async function setThemePreference(preference: ThemePreference) {
  try {
    await AsyncStorage.setItem(KEY, preference);
  } catch {
    // Worst case the preference doesn't survive a relaunch — same as leaving it at default.
  }
}
