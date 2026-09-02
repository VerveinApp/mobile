import { estimateCaloriesBurned } from '@/lib/calorie-estimate';

describe('estimateCaloriesBurned', () => {
  it('returns 0 for an empty session', () => {
    expect(estimateCaloriesBurned([], 70)).toBe(0);
  });

  it('sums per-exercise kcal using each exercise\'s own intensity and duration', () => {
    const kcal = estimateCaloriesBurned(
      [
        { intensity: 'low', durationMin: 10 },
        { intensity: 'high', durationMin: 5 },
      ],
      70
    );
    // low: (2.5*3.5*70/200)*10 = 30.625, high: (6.5*3.5*70/200)*5 = 39.8125
    expect(kcal).toBe(Math.round(30.625 + 39.8125));
  });

  it('falls back to the medium MET bucket for a null intensity, never dropping the exercise', () => {
    const withNull = estimateCaloriesBurned([{ intensity: null, durationMin: 10 }], 70);
    const withMedium = estimateCaloriesBurned([{ intensity: 'medium', durationMin: 10 }], 70);
    expect(withNull).toBe(withMedium);
    expect(withNull).toBeGreaterThan(0);
  });

  it('treats a null duration as zero minutes rather than throwing', () => {
    expect(estimateCaloriesBurned([{ intensity: 'high', durationMin: null }], 70)).toBe(0);
  });

  it('scales with bodyweight', () => {
    const lighter = estimateCaloriesBurned([{ intensity: 'medium', durationMin: 20 }], 50);
    const heavier = estimateCaloriesBurned([{ intensity: 'medium', durationMin: 20 }], 100);
    expect(heavier).toBeGreaterThan(lighter);
  });
});
