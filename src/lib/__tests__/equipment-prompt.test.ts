import AsyncStorage from '@react-native-async-storage/async-storage';

import { dismissEquipmentPrompt, shouldAskForEquipment } from '@/lib/equipment-prompt';
import type { UserProfile } from '@/lib/user-profile';

describe("Home's equipment card", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('asks a home or minimal setup that never answered, until dismissed', async () => {
    const profile: UserProfile = { environment: 'home-gym' };
    expect(await shouldAskForEquipment(profile)).toBe(true);
    await dismissEquipmentPrompt();
    expect(await shouldAskForEquipment(profile)).toBe(false);
  });

  it('never asks once answered — "none" included — or for a full gym or bodyweight setup', async () => {
    expect(await shouldAskForEquipment({ environment: 'minimal-equipment', equipment: 'none' })).toBe(false);
    expect(await shouldAskForEquipment({ environment: 'home-gym', equipment: 'dumbbell' })).toBe(false);
    expect(await shouldAskForEquipment({ environment: 'full-gym' })).toBe(false);
    expect(await shouldAskForEquipment({ environment: 'bodyweight-only' })).toBe(false);
    expect(await shouldAskForEquipment(null)).toBe(false);
  });
});
