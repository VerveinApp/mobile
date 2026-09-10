import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearMilestones,
  getLifetimeSessionCount,
  getShownMilestones,
  recordSessionForMilestones,
  restoreMilestones,
} from '@/lib/session-milestones';

describe('session-milestones', () => {
  afterEach(async () => {
    await clearMilestones();
  });

  it('starts at a lifetime count of 0 with nothing shown', async () => {
    expect(await getLifetimeSessionCount()).toBe(0);
    expect(await getShownMilestones()).toEqual([]);
  });

  it('recordSessionForMilestones increments the lifetime count every call', async () => {
    await recordSessionForMilestones();
    await recordSessionForMilestones();
    expect(await getLifetimeSessionCount()).toBe(2);
  });

  it('returns the milestone number the instant it is newly reached (the 1st session)', async () => {
    expect(await recordSessionForMilestones()).toBe(1);
  });

  it('returns null for a non-milestone session count', async () => {
    await recordSessionForMilestones(); // 1 -> milestone
    expect(await recordSessionForMilestones()).toBeNull(); // 2 -> not a milestone
  });

  it('never re-fires an already-shown milestone even if the count is somehow re-derived onto it', async () => {
    await recordSessionForMilestones(); // reaches 1, shown
    await restoreMilestones(0, [1]); // count reset but 1 already marked shown
    expect(await recordSessionForMilestones()).toBeNull(); // back to 1, already shown
  });

  it('getShownMilestones reflects every milestone actually celebrated so far', async () => {
    for (let i = 0; i < 10; i++) await recordSessionForMilestones();
    expect(await getShownMilestones()).toEqual([1, 10]);
  });

  it('restoreMilestones overwrites both the counter and the shown list wholesale', async () => {
    await restoreMilestones(37, [1, 10, 25]);
    expect(await getLifetimeSessionCount()).toBe(37);
    expect(await getShownMilestones()).toEqual([1, 10, 25]);
  });

  it('clearMilestones wipes both the counter and the shown list', async () => {
    await restoreMilestones(37, [1, 10, 25]);
    await clearMilestones();
    expect(await getLifetimeSessionCount()).toBe(0);
    expect(await getShownMilestones()).toEqual([]);
  });

  it('reads a pre-existing plain-integer-string count (the old, pre-refactor on-disk encoding) correctly — REGRESSION GUARD: real installs have this exact raw value on disk today, not JSON', async () => {
    await AsyncStorage.setItem('vervein.lifetimeSessionCount.v1', '42');
    expect(await getLifetimeSessionCount()).toBe(42);
  });
});
