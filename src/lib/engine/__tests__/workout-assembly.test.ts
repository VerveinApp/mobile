import { assembleWorkout } from '@/lib/engine/workout-assembly';
import { makeExercise, makeScaledExercise } from '@/lib/engine/testing/test-fixtures';

describe('assembleWorkout', () => {
  it('throws the M10 contract violation for 0 exercises', () => {
    expect(() => assembleWorkout([], false)).toThrow(/fewer than 2 exercises/);
  });

  it('throws the M10 contract violation for exactly 1 exercise — this is the exact shape of the real bug plan-preview.ts\'s time-trim once produced', () => {
    expect(() => assembleWorkout([makeScaledExercise()], false)).toThrow(/fewer than 2 exercises/);
  });

  it('does not throw for exactly 2 exercises — the real floor plan-preview.ts\'s trim must never go below', () => {
    const list = [makeScaledExercise({ exerciseId: 'a' }), makeScaledExercise({ exerciseId: 'b' })];
    expect(() => assembleWorkout(list, false)).not.toThrow();
  });

  it('sums totalDuration only over exercises that actually carry a duration field', () => {
    const list = [
      makeScaledExercise({ exerciseId: 'a', adapted_duration_min: 5 }),
      makeScaledExercise({ exerciseId: 'b', adapted_duration_min: 10 }),
      makeScaledExercise({ exerciseId: 'c', adapted_duration_min: null }),
    ];
    const { workout, knownGaps } = assembleWorkout(list, false);
    expect(workout.totalDuration).toBe(15);
    expect(knownGaps.some((g) => g.includes('1 discrete'))).toBe(true);
  });

  it('accepts the Fallback branch\'s [Exercise, Exercise] tuple and sums real base_duration_min', () => {
    const pair: [ReturnType<typeof makeExercise>, ReturnType<typeof makeExercise>] = [
      makeExercise({ id: 'a', base_duration_min: 3 }),
      makeExercise({ id: 'b', base_duration_min: 4 }),
    ];
    const { workout } = assembleWorkout(pair, true);
    expect(workout.isRestDay).toBe(true);
    expect(workout.totalDuration).toBe(7);
  });
});
