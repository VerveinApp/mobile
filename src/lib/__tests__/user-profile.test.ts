import AsyncStorage from '@react-native-async-storage/async-storage';

import { getProfile, saveProfile, withHealthConsent, withdrawHealthConsent } from '@/lib/user-profile';

describe('withdrawHealthConsent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('clears every consented health field and the consent itself, keeping the rest of the plan', async () => {
    await saveProfile({
      name: 'Sam',
      goal: 'get-stronger',
      days: 'monday,thursday',
      ...withHealthConsent('true'),
      sex: 'female',
      heightCm: '170',
      weightKg: '64',
      age: '29',
      conditions: ['asthma'],
      movementRestrictions: ['overhead'],
    });

    await withdrawHealthConsent();
    const profile = await getProfile();

    expect(profile?.healthConsent).toBe('false');
    expect(profile?.healthConsentedAt).toBeUndefined();
    expect(profile?.sex).toBeUndefined();
    expect(profile?.heightCm).toBeUndefined();
    expect(profile?.weightKg).toBeUndefined();
    expect(profile?.age).toBeUndefined();
    expect(profile?.conditions).toBeUndefined();
    expect(profile?.movementRestrictions).toBeUndefined();
    expect(profile?.name).toBe('Sam');
    expect(profile?.goal).toBe('get-stronger');
    expect(profile?.days).toBe('monday,thursday');
  });
});
