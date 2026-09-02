import { localDateStr } from '@/lib/local-date';
import {
  clearWorkoutLog,
  deleteWorkoutLog,
  getAllWorkoutLogs,
  getBodyAreaBreakdown,
  getCompletionStatus,
  getLoggedSessionCount,
  getMovementPatternBreakdown,
  getWorkoutLog,
  saveRetroactiveWorkoutLog,
  saveWorkoutLog,
  type WorkoutLogExercise,
} from '@/lib/workout-log';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

describe('getCompletionStatus (pure)', () => {
  it('reads an empty exercise list as skipped, not a fabricated in-between state', () => {
    expect(getCompletionStatus([])).toBe('skipped');
  });

  it('reads zero-of-N completed as skipped', () => {
    const exercises: WorkoutLogExercise[] = [
      { name: 'A', bodyArea: 'upper', completed: false },
      { name: 'B', bodyArea: 'lower', completed: false },
    ];
    expect(getCompletionStatus(exercises)).toBe('skipped');
  });

  it('reads all-of-N completed as done', () => {
    const exercises: WorkoutLogExercise[] = [
      { name: 'A', bodyArea: 'upper', completed: true },
      { name: 'B', bodyArea: 'lower', completed: true },
    ];
    expect(getCompletionStatus(exercises)).toBe('done');
  });

  it('reads some-but-not-all completed as partial', () => {
    const exercises: WorkoutLogExercise[] = [
      { name: 'A', bodyArea: 'upper', completed: true },
      { name: 'B', bodyArea: 'lower', completed: false },
    ];
    expect(getCompletionStatus(exercises)).toBe('partial');
  });
});

describe('workout-log storage', () => {
  afterEach(async () => {
    await clearWorkoutLog();
  });

  it('saveWorkoutLog then getWorkoutLog round-trips exercises for that date', async () => {
    const exercises: WorkoutLogExercise[] = [{ name: 'Barbell Back Squat', bodyArea: 'lower', completed: true }];
    await saveWorkoutLog(daysAgoStr(0), exercises);
    const entry = await getWorkoutLog(daysAgoStr(0));
    expect(entry?.exercises).toEqual(exercises);
    expect(entry?.retroactive).toBeUndefined();
  });

  it('getWorkoutLog returns null for a date with no entry', async () => {
    expect(await getWorkoutLog(daysAgoStr(0))).toBeNull();
  });

  it('a second saveWorkoutLog for the same date replaces (not merges) that date\'s exercises', async () => {
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'A', bodyArea: 'upper', completed: false }]);
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'B', bodyArea: 'lower', completed: true }]);
    const entry = await getWorkoutLog(daysAgoStr(0));
    expect(entry?.exercises).toEqual([{ name: 'B', bodyArea: 'lower', completed: true }]);
  });

  it('saveRetroactiveWorkoutLog flags the entry retroactive; the live saveWorkoutLog path never does', async () => {
    await saveRetroactiveWorkoutLog(daysAgoStr(20), [{ name: 'A', bodyArea: 'core', completed: true }]);
    const entry = await getWorkoutLog(daysAgoStr(20));
    expect(entry?.retroactive).toBe(true);
  });

  it('getAllWorkoutLogs returns entries most-recent-first', async () => {
    await saveWorkoutLog(daysAgoStr(3), []);
    await saveWorkoutLog(daysAgoStr(1), []);
    await saveWorkoutLog(daysAgoStr(2), []);
    const logs = await getAllWorkoutLogs();
    expect(logs.map((e) => e.date)).toEqual([daysAgoStr(1), daysAgoStr(2), daysAgoStr(3)]);
  });

  it('deleteWorkoutLog removes only the targeted date', async () => {
    await saveWorkoutLog(daysAgoStr(1), []);
    await saveWorkoutLog(daysAgoStr(2), []);
    await deleteWorkoutLog(daysAgoStr(1));
    const logs = await getAllWorkoutLogs();
    expect(logs.map((e) => e.date)).toEqual([daysAgoStr(2)]);
  });

  it('getLoggedSessionCount only counts days with at least one ACTUALLY completed exercise, not just an opened entry', async () => {
    // Opened-but-abandoned: an entry exists, but nothing was actually completed.
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'A', bodyArea: 'upper', completed: false }]);
    expect(await getLoggedSessionCount()).toBe(0);

    await saveWorkoutLog(daysAgoStr(1), [{ name: 'B', bodyArea: 'lower', completed: true }]);
    expect(await getLoggedSessionCount()).toBe(1);
  });

  it('getLoggedSessionCount respects the sinceDays trailing-window cutoff', async () => {
    await saveWorkoutLog(daysAgoStr(1), [{ name: 'A', bodyArea: 'upper', completed: true }]);
    await saveWorkoutLog(daysAgoStr(10), [{ name: 'B', bodyArea: 'upper', completed: true }]);
    expect(await getLoggedSessionCount(3)).toBe(1);
    expect(await getLoggedSessionCount()).toBe(2);
  });

  it('getBodyAreaBreakdown tallies every logged exercise (completed or not) into its own body area', async () => {
    await saveWorkoutLog(daysAgoStr(0), [
      { name: 'A', bodyArea: 'upper', completed: true },
      { name: 'B', bodyArea: 'upper', completed: false },
      { name: 'C', bodyArea: 'lower', completed: true },
    ]);
    const breakdown = await getBodyAreaBreakdown();
    expect(breakdown.upper).toEqual({ completed: 1, total: 2 });
    expect(breakdown.lower).toEqual({ completed: 1, total: 1 });
    expect(breakdown.core).toEqual({ completed: 0, total: 0 });
  });

  it('getBodyAreaBreakdown respects the sinceDays trailing-window cutoff', async () => {
    await saveWorkoutLog(daysAgoStr(1), [{ name: 'A', bodyArea: 'core', completed: true }]);
    await saveWorkoutLog(daysAgoStr(10), [{ name: 'B', bodyArea: 'core', completed: true }]);
    const recent = await getBodyAreaBreakdown(3);
    expect(recent.core.total).toBe(1);
    const all = await getBodyAreaBreakdown();
    expect(all.core.total).toBe(2);
  });

  it('getMovementPatternBreakdown joins each logged exercise against the real library by name', async () => {
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'Standing Barbell Overhead Press', bodyArea: 'upper', completed: true }]);
    const breakdown = await getMovementPatternBreakdown();
    expect(breakdown.overhead).toEqual({ completed: 1, total: 1 });
  });

  it('an exercise with multiple movement patterns counts toward every one of them (correct double-counting, not a bug)', async () => {
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'Medicine Ball Squat-to-Press', bodyArea: 'full', completed: true }]);
    const breakdown = await getMovementPatternBreakdown();
    expect(breakdown.squat).toEqual({ completed: 1, total: 1 });
    expect(breakdown.overhead).toEqual({ completed: 1, total: 1 });
  });

  it('an exercise name that no longer resolves in the library is silently skipped, not guessed at', async () => {
    await saveWorkoutLog(daysAgoStr(0), [{ name: 'Not A Real Exercise Name', bodyArea: 'upper', completed: true }]);
    const breakdown = await getMovementPatternBreakdown();
    expect(Object.keys(breakdown)).toHaveLength(0);
  });
});
