import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.themePreference.v1';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Defaults dark — the app is still dark-mode-built end to end; light mode
 * is opt-in per screen as it gets converted, not yet the finished standard. */
export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : 'dark';
  } catch {
    return 'dark';
  }
}

export async function setThemePreference(preference: ThemePreference) {
  try {
    await AsyncStorage.setItem(KEY, preference);
  } catch {
    // Worst case the preference doesn't survive a relaunch — same as leaving it at default.
  }
}
