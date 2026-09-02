import {
  getAllExercisePerformances,
  getImprovedExercises,
  getLastPerformance,
  recordPerformance,
  clearExercisePerformance,
  restoreExercisePerformance,
} from '@/lib/exercise-performance';

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

  it('always overwrites the stored "last" performance, even when it is not an improvement', async () => {
    await recordPerformance('Row', 50, 10);
    await recordPerformance('Row', 45, 10);
    const last = await getLastPerformance('Row');
    expect(last?.weightKg).toBe(45);
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
});
