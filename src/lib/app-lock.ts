import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.appLockEnabled.v1';

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean) {
  try {
    await AsyncStorage.setItem(KEY, String(enabled));
  } catch {
    // Worst case the preference doesn't stick — same as leaving it at default (off).
  }
}
