import { localDateStr } from '@/lib/local-date';
import {
  clearSessionHistory,
  deleteSessionHistoryEntry,
  getSessionFeedback,
  getSessionHistory,
  getSessionNote,
  getWeekActivity,
  recordPastSessionCompletion,
  recordSessionCompletion,
  saveSessionFeedback,
  saveSessionNote,
} from '@/lib/session-history';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

describe('session-history', () => {
  afterEach(async () => {
    await clearSessionHistory();
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
    const todayWeekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
    const { days } = await getWeekActivity([]); // nothing scheduled at all
    const today = days.find((d) => d.weekday === todayWeekday)!;
    expect(today.isScheduled).toBe(false);
    expect(today.completed).toBe(true);
  });

  it('getWeekActivity: scheduledCount/completedCount only count scheduled days', async () => {
    const todayWeekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
    await recordSessionCompletion(true);
    const { completedCount, scheduledCount } = await getWeekActivity([todayWeekday]);
    expect(scheduledCount).toBe(1);
    expect(completedCount).toBe(1);

    const { completedCount: completedWhenUnscheduled } = await getWeekActivity([]);
    expect(completedWhenUnscheduled).toBe(0);
  });

  it('getWeekActivity marks future days as completed:null and isFuture:true regardless of scheduling', async () => {
    const { days } = await getWeekActivity(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    const todayIndex = days.findIndex((d) => d.isToday);
    for (let i = todayIndex + 1; i < days.length; i++) {
      expect(days[i].isFuture).toBe(true);
      expect(days[i].completed).toBeNull();
    }
  });
});
