import AsyncStorage from '@react-native-async-storage/async-storage';

import { claimLocalDataIfUnowned, forgetLocalDataOwner, prepareLocalDataForAccount } from '@/lib/account-switch';
import { buildBackupPayload, clearAllLocalData } from '@/lib/data-backup';
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

describe('claimLocalDataIfUnowned', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("protects an upgrader's data once the signed-in account claims it at launch", async () => {
    // Signed in since before account switching existed: data, but no owner.
    await seedAccountData('Sam');
    await claimLocalDataIfUnowned('user-a');

    // Later: Sam signs out and someone else signs in on this phone.
    expect(await prepareLocalDataForAccount('user-b')).toBe('fresh');
    expect(await getProfile()).toBeNull();

    // Sam's data comes back when Sam signs in again.
    expect(await prepareLocalDataForAccount('user-a')).toBe('restored');
    expect((await getProfile())?.name).toBe('Sam');
  });

  it('never overwrites an owner that is already recorded', async () => {
    await seedAccountData('Sam');
    await prepareLocalDataForAccount('user-a');
    await claimLocalDataIfUnowned('user-b');

    expect(await prepareLocalDataForAccount('user-a')).toBe('same-account');
    expect((await getProfile())?.name).toBe('Sam');
  });
});

describe('account switching edge cases', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("carries one person's flags with their account, never to the next", async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    await AsyncStorage.multiSet([
      ['vervein.paywallShown.v1', 'true'],
      ['vervein.healthKitConnected.v1', 'true'],
    ]);

    await prepareLocalDataForAccount('user-b');
    expect(await AsyncStorage.getItem('vervein.paywallShown.v1')).toBeNull();
    expect(await AsyncStorage.getItem('vervein.healthKitConnected.v1')).toBeNull();

    await prepareLocalDataForAccount('user-a');
    expect(await AsyncStorage.getItem('vervein.paywallShown.v1')).toBe('true');
    expect(await AsyncStorage.getItem('vervein.healthKitConnected.v1')).toBe('true');
  });

  it('finishes a switch the app was killed in the middle of, without losing the first account', async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    // The state a kill leaves behind: Alex set aside, the device cleared,
    // the switch to user-b marked but never finished.
    await AsyncStorage.setItem(
      'vervein.accountStash.user-a.v1',
      JSON.stringify({ payload: await buildBackupPayload(), onboarded: true, accountStartDate: '2026-09-01' })
    );
    await AsyncStorage.setItem('vervein.accountSwitchPending.v1', JSON.stringify({ from: 'user-a', to: 'user-b' }));
    await clearAllLocalData();

    expect(await prepareLocalDataForAccount('user-b')).toBe('same-account');
    expect(await getProfile()).toBeNull();

    expect(await prepareLocalDataForAccount('user-a')).toBe('restored');
    expect((await getProfile())?.name).toBe('Alex');
    expect(await getSessionHistory()).toHaveLength(1);
  });

  it("never overwrites an account's set-aside data with an empty device", async () => {
    await seedAccountData('Alex');
    await prepareLocalDataForAccount('user-a');
    await prepareLocalDataForAccount('user-b'); // Alex set aside; device fresh for user-b
    // user-b never onboards; Alex's stash must survive user-b's empty device
    // being set aside and Alex coming back.
    expect(await prepareLocalDataForAccount('user-a')).toBe('restored');
    expect((await getProfile())?.name).toBe('Alex');
  });
});

