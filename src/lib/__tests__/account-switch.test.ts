import AsyncStorage from '@react-native-async-storage/async-storage';

import { forgetLocalDataOwner, prepareLocalDataForAccount } from '@/lib/account-switch';
import { getAccountStartDate, hasCompletedOnboarding, markOnboardingComplete } from '@/lib/onboarding-draft';
import { getProgressPhotos } from '@/lib/progress-photos';
import { getSessionHistory, recordPastSessionCompletion } from '@/lib/session-history';
import { getProfile, saveProfile } from '@/lib/user-profile';

// clearAllLocalData cancels scheduled reminders; the real expo-notifications
// module only prints an Expo Go warning under jest and slows the run.
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));

const PHOTOS_KEY = 'vervein.progressPhotos.v1';

async function seedAccountData(name: string): Promise<void> {
  await saveProfile({ name, goal: 'get-stronger', days: 'monday,wednesday' });
  await markOnboardingComplete();
  await recordPastSessionCompletion('2026-09-01', true, 4, 'done');
  await AsyncStorage.setItem(
    PHOTOS_KEY,
    JSON.stringify([{ id: `${name}-photo`, date: '2026-09-01', fileName: 'p.jpg', createdAt: '2026-09-01T08:00:00.000Z' }])
  );
}

describe('prepareLocalDataForAccount', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('claims existing data for the first account that signs in', async () => {
    await seedAccountData('Alex');
    expect(await prepareLocalDataForAccount('user-a')).toBe('same-account');
    expect((await getProfile())?.name).toBe('Alex');
  });

  it('leaves data alone when the same account signs back in', async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    expect(await prepareLocalDataForAccount('user-a')).toBe('same-account');
    expect((await getProfile())?.name).toBe('Alex');
    expect(await getSessionHistory()).toHaveLength(1);
  });

  it("never shows a different account the previous account's data", async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');

    expect(await prepareLocalDataForAccount('user-b')).toBe('fresh');
    expect(await getProfile()).toBeNull();
    expect(await hasCompletedOnboarding()).toBe(false);
    expect(await getSessionHistory()).toEqual([]);
    expect(await getProgressPhotos()).toEqual([]);
  });

  it("brings each account's own data back when it signs in again", async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    const startDate = await getAccountStartDate();

    await prepareLocalDataForAccount('user-b');
    await seedAccountData('Blair');

    expect(await prepareLocalDataForAccount('user-a')).toBe('restored');
    expect((await getProfile())?.name).toBe('Alex');
    expect(await hasCompletedOnboarding()).toBe(true);
    expect(await getAccountStartDate()).toBe(startDate);
    expect((await getProgressPhotos()).map((p) => p.id)).toEqual(['Alex-photo']);

    expect(await prepareLocalDataForAccount('user-b')).toBe('restored');
    expect((await getProfile())?.name).toBe('Blair');
  });

  it('treats the device as unowned after the account is deleted', async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    await forgetLocalDataOwner();
    expect(await prepareLocalDataForAccount('user-c')).toBe('same-account');
  });
});
