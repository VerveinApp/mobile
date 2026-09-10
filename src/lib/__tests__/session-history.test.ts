import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateStr } from '@/lib/local-date';
import { getAccountStartDate } from '@/lib/onboarding-draft';
import { WEEKDAY_NAMES } from '@/lib/profile-labels';
import {
  clearSessionHistory,
  deleteSessionHistoryEntry,
  getSessionFeedback,
  getSessionHistory,
  getSessionNote,
  getWeekActivity,
  getWeeklyCaloriesBurned,
  recordPastSessionCompletion,
  recordSessionCompletion,
  resolveWeeklyCaloriesBurned,
  restoreSessionHistory,
  saveSessionFeedback,
  saveSessionNote,
} from '@/lib/session-history';

// Same keys onboarding-draft.ts's own getAccountStartDate/markOnboardingComplete
// read and write — no setter is exported that can backdate one (the real one
// always stamps "now"), so writing them directly is the only way to test
// both a backdated account and the completed-onboarding backfill path from a
// test that can't control the system clock.
const ACCOUNT_START_DATE_KEY = 'vervein.accountStartDate.v1';
const ONBOARDING_COMPLETED_KEY = 'vervein.onboardingCompleted.v1';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

// Pinned rather than read from the real clock — two tests below used to
// derive "today's weekday" from a fresh `new Date().getDay()` call, which
// made them pass or fail depending on which real day the suite happened to
// run on (unreproducible locally on a different day, and incapable of ever
// exercising a weekday-specific bug in getWeekActivity except on that one
// day of the week). Freezing the system clock for the whole file makes
// every real `new Date()` call in both this file and the library code under
// test (daysAgoStr, localDateStr, getAccountStartDate) agree on the same
// fixed "now" deterministically, on any machine, on any day.
const FIXED_NOW = new Date(2026, 5, 17, 12, 0, 0); // Wednesday, June 17 2026, local noon
const TODAY_WEEKDAY = WEEKDAY_NAMES[FIXED_NOW.getDay()];

describe('session-history', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    jest.setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(async () => {
    await clearSessionHistory();
    await AsyncStorage.removeItem(ACCOUNT_START_DATE_KEY);
    await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  });

  it('recordSessionCompletion then getSessionHistory round-trips date/completed/energy/completionStatus', async () => {
    await recordSessionCompletion(true, 4, 'done');
    const history = await getSessionHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ date: daysAgoStr(0), completed: true, energy: 4, completionStatus: 'done' });
  });

  it('getSessionHistory returns entries most-recent-first', async () => {
    await recordPastSessionCompletion(daysAgoStr(5), true);
    await recordPastSessionCompletion(daysAgoStr(1), true);
    await recordPastSessionCompletion(daysAgoStr(3), true);
    const history = await getSessionHistory();
    expect(history.map((e) => e.date)).toEqual([daysAgoStr(1), daysAgoStr(3), daysAgoStr(5)]);
  });

  it('a second recordSessionCompletion call for today merges rather than wiping an already-attached note', async () => {
    await recordSessionCompletion(false, 3, 'skipped');
    await saveSessionNote(daysAgoStr(0), 'felt rough this morning');
    await recordSessionCompletion(true, 4, 'done');

    const history = await getSessionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].completed).toBe(true);
    expect(history[0].completionStatus).toBe('done');
    expect(history[0].notes).toBe('felt rough this morning');
  });

  it('recordPastSessionCompletion marks the entry loggedRetroactively and does not touch other dates', async () => {
    await recordSessionCompletion(true, 5, 'done');
    await recordPastSessionCompletion(daysAgoStr(10), true, 3, 'partial');

    const history = await getSessionHistory();
    const today = history.find((e) => e.date === daysAgoStr(0));
    const backfilled = history.find((e) => e.date === daysAgoStr(10));
    expect(today?.loggedRetroactively).toBeUndefined();
    expect(backfilled?.loggedRetroactively).toBe(true);
  });

  it('deleteSessionHistoryEntry removes only the targeted date', async () => {
    await recordPastSessionCompletion(daysAgoStr(1), true);
    await recordPastSessionCompletion(daysAgoStr(2), true);
    await deleteSessionHistoryEntry(daysAgoStr(1));

    const history = await getSessionHistory();
    expect(history.map((e) => e.date)).toEqual([daysAgoStr(2)]);
  });

  it('saveSessionNote/getSessionNote round-trips, and is a no-op when that day has no entry yet', async () => {
    await saveSessionNote(daysAgoStr(0), 'a note with nothing logged yet');
    expect(await getSessionNote(daysAgoStr(0))).toBeUndefined();

    await recordSessionCompletion(true);
    await saveSessionNote(daysAgoStr(0), '  trimmed note  ');
    expect(await getSessionNote(daysAgoStr(0))).toBe('trimmed note');
  });

  it('saveSessionFeedback/getSessionFeedback round-trips, and is a no-op when that day has no entry yet', async () => {
    await saveSessionFeedback(daysAgoStr(0), 'just_right');
    expect(await getSessionFeedback(daysAgoStr(0))).toBeUndefined();

    await recordSessionCompletion(true);
    await saveSessionFeedback(daysAgoStr(0), 'too_hard');
    expect(await getSessionFeedback(daysAgoStr(0))).toBe('too_hard');
  });

  it('getWeekActivity returns a Monday-first, Sunday-last 7-day week', async () => {
    const { days } = await getWeekActivity([]);
    expect(days).toHaveLength(7);
    expect(days[0].weekday).toBe('monday');
    expect(days[6].weekday).toBe('sunday');
  });

  it('getWeekActivity: an unscheduled day still reports its real completed history, only isScheduled differs', async () => {
    await recordSessionCompletion(true);
    const { days } = await getWeekActivity([]); // nothing scheduled at all
    const today = days.find((d) => d.weekday === TODAY_WEEKDAY)!;
    expect(today.isScheduled).toBe(false);
    expect(today.completed).toBe(true);
  });

  it('getWeekActivity: scheduledCount/completedCount only count scheduled days', async () => {
    await recordSessionCompletion(true);
    const { completedCount, scheduledCount } = await getWeekActivity([TODAY_WEEKDAY]);
    expect(scheduledCount).toBe(1);
    expect(completedCount).toBe(1);

    const { completedCount: completedWhenUnscheduled } = await getWeekActivity([]);
    expect(completedWhenUnscheduled).toBe(0);
  });

  it('getWeekActivity never marks a day scheduled/missed from before the account existed', async () => {
    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    // Backdate the account to start tomorrow — today (and every earlier day
    // this week) should read as "before the account existed," regardless of
    // which real weekday this test happens to run on. Days from tomorrow
    // onward are unaffected by this fix — they were already future days,
    // still legitimately "scheduled," just not completed yet.
    await AsyncStorage.setItem(ACCOUNT_START_DATE_KEY, daysAgoStr(-1));
    const { days, completedCount } = await getWeekActivity(allDays);
    const today = days.find((d) => d.isToday)!;
    expect(today.isScheduled).toBe(false);
    // No session was ever recorded, so nothing should read as completed
    // regardless of scheduling.
    expect(completedCount).toBe(0);
  });

  it('getWeekActivity treats a real account start date as scheduling normally from that day on', async () => {
    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    await AsyncStorage.setItem(ACCOUNT_START_DATE_KEY, daysAgoStr(0));
    const { days } = await getWeekActivity(allDays);
    const today = days.find((d) => d.isToday)!;
    expect(today.isScheduled).toBe(true);
  });

  it('getAccountStartDate backfills today for an already-onboarded account with none on file — REGRESSION GUARD: an account that finished onboarding before this field existed must not read null forever', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    expect(await getAccountStartDate()).toBe(daysAgoStr(0));
    // Persisted, not regenerated on every read.
    expect(await AsyncStorage.getItem(ACCOUNT_START_DATE_KEY)).toBe(daysAgoStr(0));
  });

  it('getAccountStartDate never backfills for a device that has not completed onboarding', async () => {
    expect(await getAccountStartDate()).toBeNull();
  });

  it('getWeekActivity marks future days as completed:null and isFuture:true regardless of scheduling', async () => {
    const { days } = await getWeekActivity(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    const todayIndex = days.findIndex((d) => d.isToday);
    for (let i = todayIndex + 1; i < days.length; i++) {
      expect(days[i].isFuture).toBe(true);
      expect(days[i].completed).toBeNull();
    }
  });

  it('getWeeklyCaloriesBurned sums caloriesBurned across this week only', async () => {
    await recordPastSessionCompletion(daysAgoStr(2), true, 4, 'done');
    // recordPastSessionCompletion never sets caloriesBurned (no honest
    // per-exercise estimate exists for a backfilled day) — write it via the
    // real recordSessionCompletion path instead so this actually exercises
    // the field recordSessionCompletion owns.
    await recordSessionCompletion(true, 4, 'done', 300);
    expect(await getWeeklyCaloriesBurned()).toBe(300);
  });

  it('getWeeklyCaloriesBurned excludes entries from before this Monday', async () => {
    await recordPastSessionCompletion(daysAgoStr(9), true, 4, 'done');
    const entries = await getSessionHistory();
    // Directly stamp a caloriesBurned onto a real week-old entry — no public
    // writer sets both a backdated date and a real caloriesBurned together,
    // since that combination (an honest per-exercise estimate for a day
    // that already happened) never occurs from either real call site.
    const nineDaysAgo = entries.find((e) => e.date === daysAgoStr(9))!;
    nineDaysAgo.caloriesBurned = 500;
    await restoreSessionHistory(entries);
    expect(await getWeeklyCaloriesBurned()).toBe(0);
  });

  it('getWeeklyCaloriesBurned treats a missing caloriesBurned as 0, not a crash', async () => {
    await recordSessionCompletion(true, 4, 'done');
    expect(await getWeeklyCaloriesBurned()).toBe(0);
  });

  it('resolveWeeklyCaloriesBurned prefers the real HealthKit total when present', () => {
    expect(resolveWeeklyCaloriesBurned(300, 450)).toEqual({ kcal: 450, isEstimate: false });
  });

  it('resolveWeeklyCaloriesBurned falls back to the on-device estimate when HealthKit is not connected', () => {
    expect(resolveWeeklyCaloriesBurned(300, null)).toEqual({ kcal: 300, isEstimate: true });
  });

  it('resolveWeeklyCaloriesBurned trusts a real, connected zero rather than falling back', () => {
    expect(resolveWeeklyCaloriesBurned(300, 0)).toEqual({ kcal: 0, isEstimate: false });
  });

  it('a later call with no caloriesBurned argument does not wipe an already-recorded value', async () => {
    await recordSessionCompletion(true, 4, 'done', 450);
    // e.g. a hypothetical later same-day call that has no calorie estimate
    // to report — should preserve the earlier real value, not overwrite it
    // with undefined, the same fallback checkedInAtHour already gets.
    await recordSessionCompletion(true, 4, 'done');
    const history = await getSessionHistory();
    expect(history[0].caloriesBurned).toBe(450);
  });
});
