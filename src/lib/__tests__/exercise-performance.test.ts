import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getAllExercisePerformances,
  getImprovedExercises,
  getLastPerformance,
  getPerformanceHistory,
  recordPerformance,
  recordPerformanceBatch,
  clearExercisePerformance,
  restoreExercisePerformance,
} from '@/lib/exercise-performance';

const KEY = 'vervein.exercisePerformance.v1';

describe('recordPerformance', () => {
  afterEach(async () => {
    await clearExercisePerformance();
  });

  it('the first time an exercise is logged, improved is false (nothing to compare against)', async () => {
    const { current, previous, oneRepMaxRatio } = await recordPerformance('Bench Press', 60, 8);
    expect(previous).toBeNull();
    expect(current.improved).toBe(false);
    expect(oneRepMaxRatio).toBe(1);
    // Epley: 60 * (1 + 8/30)
    expect(current.estimatedOneRepMax).toBeCloseTo(60 * (1 + 8 / 30), 5);
  });

  it('flags a real >=2% 1RM jump as improved', async () => {
    await recordPerformance('Squat', 100, 5);
    const { current } = await recordPerformance('Squat', 110, 5);
    expect(current.improved).toBe(true);
  });

  it('does not flag a trivial (<2%) fluctuation as improved', async () => {
    await recordPerformance('Deadlift', 100, 5);
    const { current } = await recordPerformance('Deadlift', 100.5, 5);
    expect(current.improved).toBe(false);
  });

  it('does not flag a real regression as improved', async () => {
    await recordPerformance('Overhead Press', 40, 8);
    const { current } = await recordPerformance('Overhead Press', 35, 8);
    expect(current.improved).toBe(false);
  });

  it('flags a genuine most-reps-ever PR even when it reads as a 1RM regression', async () => {
    // Epley 1RM: 100*(1+5/30) = 116.67
    await recordPerformance('Bench Press', 100, 5);
    // Epley 1RM: 40*(1+15/30) = 60 — a big estimated-1RM "regression," but
    // 15 reps is a real personal best regardless of weight.
    const { current, oneRepMaxRatio } = await recordPerformance('Bench Press', 40, 15);
    expect(oneRepMaxRatio).toBeLessThan(1);
    expect(current.improved).toBe(true);
  });

  it('flags a genuine heaviest-weight-ever PR even when it reads as a 1RM regression', async () => {
    // Epley 1RM: 90*(1+3/30) = 99
    await recordPerformance('Squat', 90, 3);
    // Epley 1RM: 95*(1+1/30) = 98.17 — slightly lower estimated 1RM (fewer
    // reps costs more than the extra weight gains), but 95kg is a real
    // heaviest single ever lifted for this exercise.
    const { current, oneRepMaxRatio } = await recordPerformance('Squat', 95, 1);
    expect(oneRepMaxRatio).toBeLessThan(1);
    expect(current.improved).toBe(true);
  });

  it('does not flag a trivial (<2%) heaviest-weight edge as a PR', async () => {
    await recordPerformance('Deadlift', 100, 3);
    // 100.5kg is technically a new max, but it's the same plate-rounding
    // noise LOAD_IMPROVEMENT_MIN_RATIO already exists to filter for 1RM.
    const { current } = await recordPerformance('Deadlift', 100.5, 1);
    expect(current.improved).toBe(false);
  });

  it('a true regression on every axis (lighter, fewer reps, less volume) is never flagged', async () => {
    await recordPerformance('Row', 60, 10);
    const { current } = await recordPerformance('Row', 50, 8);
    expect(current.improved).toBe(false);
  });

  it('"last" always reflects the most recently logged entry, even when it is not an improvement', async () => {
    await recordPerformance('Row', 50, 10);
    await recordPerformance('Row', 45, 10);
    const last = await getLastPerformance('Row');
    expect(last?.weightKg).toBe(45);
  });

  it('getPerformanceHistory keeps every logged entry, oldest first — the real data behind the line chart', async () => {
    await recordPerformance('Leg Press', 100, 10);
    await recordPerformance('Leg Press', 110, 10);
    await recordPerformance('Leg Press', 105, 10);
    const history = await getPerformanceHistory('Leg Press');
    expect(history.map((h) => h.weightKg)).toEqual([100, 110, 105]);
  });

  it('caps history per exercise at 20 entries, dropping the oldest first', async () => {
    for (let i = 0; i < 25; i++) {
      await recordPerformance('Cable Row', 50 + i, 10);
    }
    const history = await getPerformanceHistory('Cable Row');
    expect(history.length).toBe(20);
    expect(history[0].weightKg).toBe(55); // the first 5 (50-54) were trimmed
    expect(history[history.length - 1].weightKg).toBe(74);
  });

  it('getImprovedExercises only lists exercises whose most recent record was a real improvement', async () => {
    await recordPerformance('Lunge', 20, 10);
    await recordPerformance('Lunge', 25, 10); // improved
    await recordPerformance('Curl', 15, 10);
    await recordPerformance('Curl', 14, 10); // not improved
    const improved = await getImprovedExercises();
    const names = improved.map((e) => e.exerciseName);
    expect(names).toContain('Lunge');
    expect(names).not.toContain('Curl');
  });
});

describe('recordPerformanceBatch', () => {
  afterEach(async () => {
    await clearExercisePerformance();
  });

  it('records every exercise in one batch — the exact scenario N parallel recordPerformance calls used to lose', async () => {
    const results = await recordPerformanceBatch([
      { exerciseName: 'Bench Press', weightKg: 60, reps: 8 },
      { exerciseName: 'Squat', weightKg: 100, reps: 5 },
      { exerciseName: 'Deadlift', weightKg: 120, reps: 5 },
    ]);
    expect(results.map((r) => r.exerciseName)).toEqual(['Bench Press', 'Squat', 'Deadlift']);
    expect(await getLastPerformance('Bench Press')).not.toBeNull();
    expect(await getLastPerformance('Squat')).not.toBeNull();
    expect(await getLastPerformance('Deadlift')).not.toBeNull();
  });

  it('chains correctly when the same exercise appears twice in one batch', async () => {
    const results = await recordPerformanceBatch([
      { exerciseName: 'Curl', weightKg: 10, reps: 12 },
      { exerciseName: 'Curl', weightKg: 12, reps: 12 },
    ]);
    expect(results[1].result.previous?.weightKg).toBe(10);
    const history = await getPerformanceHistory('Curl');
    expect(history.map((h) => h.weightKg)).toEqual([10, 12]);
  });

  it('compares against history from a prior call, not just within the same batch', async () => {
    await recordPerformance('Overhead Press', 40, 8);
    const [{ result }] = await recordPerformanceBatch([{ exerciseName: 'Overhead Press', weightKg: 45, reps: 8 }]);
    expect(result.previous?.weightKg).toBe(40);
  });
});

describe('data-backup.ts integration surface', () => {
  afterEach(async () => {
    await clearExercisePerformance();
  });

  it('getAllExercisePerformances round-trips through restoreExercisePerformance', async () => {
    await recordPerformance('Pull-up', 0, 8);
    const exported = await getAllExercisePerformances();
    await clearExercisePerformance();
    expect(await getAllExercisePerformances()).toEqual({});
    await restoreExercisePerformance(exported);
    expect(await getAllExercisePerformances()).toEqual(exported);
  });

  it('clearExercisePerformance actually wipes the store — the exact gap the "Delete My Data" bug fix closed', async () => {
    await recordPerformance('Bicep Curl', 10, 12);
    expect(await getLastPerformance('Bicep Curl')).not.toBeNull();
    await clearExercisePerformance();
    expect(await getLastPerformance('Bicep Curl')).toBeNull();
  });

  it('MIGRATION: transparently upgrades pre-history data (one bare record per exercise, not an array)', async () => {
    const oldShapeRecord = {
      weightKg: 80,
      reps: 5,
      estimatedOneRepMax: 80 * (1 + 5 / 30),
      date: '2026-01-01',
      improved: false,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify({ 'Old Format Lift': oldShapeRecord }));
    expect(await getPerformanceHistory('Old Format Lift')).toEqual([oldShapeRecord]);
    expect(await getLastPerformance('Old Format Lift')).toEqual(oldShapeRecord);
    // Logging again on top of migrated data should append, not clobber.
    await recordPerformance('Old Format Lift', 85, 5);
    const history = await getPerformanceHistory('Old Format Lift');
    expect(history.length).toBe(2);
    expect(history[0]).toEqual(oldShapeRecord);
    expect(history[1].weightKg).toBe(85);
  });
});
