import {
  APP_STORE_URL,
  buildSessionSummary,
  describeSessionSummary,
  getSessionShareText,
  summaryFromWorkoutLog,
  weightsLoggedOn,
} from '@/lib/session-summary';

const START = new Date('2026-10-14T18:00:00');
const minutesLater = (m: number) => new Date(START.getTime() + m * 60 * 1000);

const plan = [
  { name: 'Goblet Squat', sets: 3, reps: 10, durationMin: 6 },
  { name: 'Push-Up', sets: 3, reps: '"8/side"', durationMin: 5 },
  { name: 'Plank', sets: 2, reps: null, durationMin: 1 },
  { name: 'Hip Flexor Stretch', sets: null, reps: null, durationMin: 2 },
];

describe('buildSessionSummary', () => {
  it('keeps only completed exercises, in plan order, with typed weights in kg', () => {
    const summary = buildSessionSummary({
      exercises: plan,
      completed: new Set([0, 2]),
      loggedWeights: { 0: '50', 1: '20', 2: '' },
      weightUnit: 'imperial',
      startedAt: START,
      finishedAt: minutesLater(42),
    });
    expect(summary.trainedSeconds).toBe(42 * 60);
    expect(summary.exercises.map((e) => e.name)).toEqual(['Goblet Squat', 'Plank']);
    expect(summary.exercises[0].weightKg).toBeCloseTo(22.68, 2);
    expect(summary.exercises[1].weightKg).toBeUndefined();
  });

  it('reads a comma decimal and ignores zero or junk weights', () => {
    const summary = buildSessionSummary({
      exercises: plan,
      completed: new Set([0, 1]),
      loggedWeights: { 0: '22,5', 1: '0' },
      weightUnit: 'metric',
      startedAt: START,
      finishedAt: minutesLater(10),
    });
    expect(summary.exercises[0].weightKg).toBe(22.5);
    expect(summary.exercises[1].weightKg).toBeUndefined();
  });

  it('records no time without a start, or when the clock went backwards', () => {
    const base = { exercises: plan, completed: new Set([0]), loggedWeights: {}, weightUnit: 'metric' as const };
    expect(buildSessionSummary({ ...base, startedAt: null, finishedAt: START }).trainedSeconds).toBeUndefined();
    expect(buildSessionSummary({ ...base, startedAt: minutesLater(5), finishedAt: START }).trainedSeconds).toBeUndefined();
  });
});

describe('describeSessionSummary', () => {
  const summary = buildSessionSummary({
    exercises: plan,
    completed: new Set([0, 1, 2, 3]),
    loggedWeights: { 0: '61.2' },
    weightUnit: 'metric',
    startedAt: START,
    finishedAt: minutesLater(65),
  });

  it('shows time, exercise and set counts, and each exercise as it was done', () => {
    const view = describeSessionSummary(summary, 'metric');
    expect(view.trainedLabel).toBe('1 hr 5 min');
    expect(view.exerciseCount).toBe(4);
    expect(view.setCount).toBe(8);
    expect(view.rows.map((r) => r.detail)).toEqual(['3 × 10 · 61.2 kg', '3 × 8/side', '2 × 1 min', '2 min']);
    expect(view.statsAccessibilityLabel).toBe('Trained 1 hour 5 minutes, 4 exercises, 8 sets');
  });

  it('converts weights to the unit being shown', () => {
    expect(describeSessionSummary(summary, 'imperial').rows[0].detail).toBe('3 × 10 · 134.9 lb');
  });

  it('hides a time under a minute or over three hours', () => {
    expect(describeSessionSummary({ ...summary, trainedSeconds: 40 }, 'metric').trainedLabel).toBeNull();
    expect(describeSessionSummary({ ...summary, trainedSeconds: 3 * 3600 + 1 }, 'metric').trainedLabel).toBeNull();
    expect(describeSessionSummary({ ...summary, trainedSeconds: 3 * 3600 }, 'metric').trainedLabel).toBe('3 hr');
  });

  it('never claims sets the plan had no count for', () => {
    const view = describeSessionSummary({ exercises: [plan[3]] }, 'metric');
    expect(view.setCount).toBeNull();
    expect(view.statsAccessibilityLabel).toBe('1 exercise');
  });
});

describe('getSessionShareText', () => {
  it('shares time and counts only, with the App Store link', () => {
    const view = describeSessionSummary({ trainedSeconds: 42 * 60, exercises: plan.slice(0, 2) }, 'metric');
    expect(getSessionShareText(view)).toBe(`Trained 42 min with VerveIn today: 2 exercises, 6 sets. ${APP_STORE_URL}`);
  });

  it('has nothing to share for a session with nothing done', () => {
    expect(getSessionShareText(describeSessionSummary({ exercises: [] }, 'metric'))).toBeNull();
  });
});

describe('rebuilding a summary for a session finished before summaries were saved', () => {
  it('uses the log, borrows numbers only from a matching plan slot, and adds today\'s weights', () => {
    const log = [
      { name: 'Goblet Squat', bodyArea: 'lower' as const, completed: true },
      { name: 'Swapped Row', bodyArea: 'upper' as const, completed: true },
      { name: 'Plank', bodyArea: 'core' as const, completed: false },
    ];
    const summary = summaryFromWorkoutLog(log, plan, { 'Goblet Squat': 30 });
    expect(summary.trainedSeconds).toBeUndefined();
    expect(summary.exercises).toEqual([
      { name: 'Goblet Squat', sets: 3, reps: 10, durationMin: 6, weightKg: 30 },
      { name: 'Swapped Row', sets: null, reps: null, durationMin: null },
    ]);
  });

  it("takes each exercise's weight only from a record dated that day", () => {
    const record = (date: string, weightKg: number) => ({ date, weightKg, reps: null, improved: false });
    const weights = weightsLoggedOn(
      {
        'Goblet Squat': [record('2026-10-13', 28), record('2026-10-14', 30)],
        'Push-Up': [record('2026-10-14', 10), record('2026-10-15', 12)],
      } as never,
      '2026-10-14'
    );
    expect(weights).toEqual({ 'Goblet Squat': 30 });
  });
});
