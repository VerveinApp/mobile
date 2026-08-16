import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.unitSystem.v1';

/** Same id/order as onboarding/step-5.tsx's per-screen toggle — this is the
 * app-wide version of that preference, set once in Settings instead of
 * re-picked every time a screen needs it. */
export type UnitSystem = 'imperial' | 'metric';

export async function getUnitSystem(): Promise<UnitSystem> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === 'metric' ? 'metric' : 'imperial';
  } catch {
    return 'imperial';
  }
}

export async function setUnitSystem(system: UnitSystem) {
  try {
    await AsyncStorage.setItem(KEY, system);
  } catch {
    // Worst case the preference doesn't stick — same as leaving it at default.
  }
}
