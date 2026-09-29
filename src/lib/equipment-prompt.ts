import AsyncStorage from '@react-native-async-storage/async-storage';

import { asksForEquipment } from '@/lib/owned-equipment';
import type { UserProfile } from '@/lib/user-profile';

const DISMISSED_KEY = 'vervein.equipmentPromptDismissed.v1';

/**
 * Home's one-time "what equipment do you have?" card — for a home gym or
 * minimal setup that has never answered (every profile from before the
 * list existed), whose plans quietly use a default kit until it does.
 * Gone for good once answered or dismissed.
 */
export async function shouldAskForEquipment(profile: UserProfile | null): Promise<boolean> {
  if (!profile || !asksForEquipment(profile.environment) || profile.equipment !== undefined) return false;
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) !== 'true';
  } catch {
    return false;
  }
}

export async function dismissEquipmentPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Worst case it asks once more next launch.
  }
}
