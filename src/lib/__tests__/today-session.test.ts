import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearTodaySession, getTodaySession, isCarriedOverSession, saveTodaySession } from '@/lib/today-session';

describe('today-session', () => {
  afterEach(async () => {
    await clearTodaySession();
  });

  it('round-trips loggedWeightsKg — the bug fix for in-progress weights not surviving an app kill', async () => {
    await saveTodaySession({ energy: 4, completed: false, symptomTags: [], finisherAccepted: false, loggedWeightsKg: { 0: '60', 2: '22.5' } });
    const session = await getTodaySession();
    expect(session?.loggedWeightsKg).toEqual({ 0: '60', 2: '22.5' });
  });

  it('omitting loggedWeightsKg (the Finish-call shape) leaves it absent, not an empty object', async () => {
    await saveTodaySession({ energy: 4, completed: true, symptomTags: [] });
    const session = await getTodaySession();
    expect(session?.loggedWeightsKg).toBeUndefined();
  });

  it('returns null for a session saved on a previous day', async () => {
    await saveTodaySession({ energy: 3, completed: false });
    const raw = await AsyncStorage.getItem('vervein.todaySession.v1');
    const stale = { ...JSON.parse(raw!), date: '2000-01-01' };
    await AsyncStorage.setItem('vervein.todaySession.v1', JSON.stringify(stale));
    expect(await getTodaySession()).toBeNull();
  });

  it('keeps a session that started before midnight and is still going', async () => {
    const startedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    await saveTodaySession({ energy: 4, completed: false, startedAt, date: '2000-01-01' });
    const session = await getTodaySession();
    expect(session?.date).toBe('2000-01-01');
    expect(session?.energy).toBe(4);
  });

  it('lets a finished or long-abandoned session from an earlier day go', () => {
    const now = Date.parse('2026-10-15T00:30:00');
    expect(isCarriedOverSession({ completed: false, startedAt: '2026-10-14T23:30:00' }, now)).toBe(true);
    expect(isCarriedOverSession({ completed: true, startedAt: '2026-10-14T23:30:00' }, now)).toBe(false);
    expect(isCarriedOverSession({ completed: false, startedAt: '2026-10-14T12:00:00' }, now)).toBe(false);
    expect(isCarriedOverSession({ completed: false }, now)).toBe(false);
  });
});
