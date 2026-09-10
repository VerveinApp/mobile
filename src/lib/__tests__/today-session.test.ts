import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearTodaySession, getTodaySession, saveTodaySession } from '@/lib/today-session';

describe('today-session', () => {
  afterEach(async () => {
    await clearTodaySession();
  });

  it('round-trips loggedWeightsKg — the bug fix for in-progress weights not surviving an app kill', async () => {
    await saveTodaySession(4, false, [], undefined, false, undefined, undefined, { 0: '60', 2: '22.5' });
    const session = await getTodaySession();
    expect(session?.loggedWeightsKg).toEqual({ 0: '60', 2: '22.5' });
  });

  it('omitting loggedWeightsKg (the Finish-call shape) leaves it absent, not an empty object', async () => {
    await saveTodaySession(4, true, []);
    const session = await getTodaySession();
    expect(session?.loggedWeightsKg).toBeUndefined();
  });

  it('returns null for a session saved on a previous day', async () => {
    await saveTodaySession(3, false);
    const raw = await AsyncStorage.getItem('vervein.todaySession.v1');
    const stale = { ...JSON.parse(raw!), date: '2000-01-01' };
    await AsyncStorage.setItem('vervein.todaySession.v1', JSON.stringify(stale));
    expect(await getTodaySession()).toBeNull();
  });
});
