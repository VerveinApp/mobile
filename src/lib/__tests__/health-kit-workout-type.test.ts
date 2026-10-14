import { workoutActivityTypeFor } from '@/lib/health-kit';

// HKWorkoutActivityType raw values.
const STRENGTH = 50;
const FLEXIBILITY = 62;
const MIXED_CARDIO = 73;
const OTHER = 3000;

describe('workoutActivityTypeFor', () => {
  it('logs a lifting day as strength training whatever the goal is', () => {
    expect(workoutActivityTypeFor(['strength', 'strength', 'power', 'mobility'], 'get-leaner')).toBe(STRENGTH);
  });

  it('logs a mobility day as flexibility', () => {
    expect(workoutActivityTypeFor(['mobility', 'recovery', 'strength'], 'build-physique')).toBe(FLEXIBILITY);
  });

  it('logs a mostly-cardio day as mixed cardio', () => {
    expect(workoutActivityTypeFor(['cardio', 'cardio', 'strength'], 'get-stronger')).toBe(MIXED_CARDIO);
  });

  it('breaks ties toward strength, then flexibility', () => {
    expect(workoutActivityTypeFor(['strength', 'cardio'], undefined)).toBe(STRENGTH);
    expect(workoutActivityTypeFor(['mobility', 'cardio'], undefined)).toBe(FLEXIBILITY);
  });

  it('falls back to the goal, then Other, when no exercise type is known', () => {
    expect(workoutActivityTypeFor([undefined, null], 'move-better')).toBe(FLEXIBILITY);
    expect(workoutActivityTypeFor([], 'get-leaner')).toBe(MIXED_CARDIO);
    expect(workoutActivityTypeFor([], undefined)).toBe(OTHER);
    expect(workoutActivityTypeFor([], 'unknown-goal')).toBe(OTHER);
  });
});
