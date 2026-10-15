import { cleanReps, formatExerciseMinutes, formatExerciseStat } from '@/lib/exercise-format';

describe('exercise format', () => {
  it('strips the literal quotes some library rep text carries', () => {
    expect(cleanReps('"12/side"')).toBe('12/side');
    expect(cleanReps('"8/side')).toBe('8/side');
    expect(cleanReps(10)).toBe('10');
    expect(cleanReps('""')).toBeNull();
  });

  it('reads short holds in seconds and longer ones in minutes', () => {
    expect(formatExerciseMinutes(0.5)).toBe('30 sec');
    expect(formatExerciseMinutes(0.75)).toBe('45 sec');
    expect(formatExerciseMinutes(1)).toBe('1 min');
    expect(formatExerciseMinutes(1.5)).toBe('1.5 min');
  });

  it('prefers sets × reps, then sets × time, then what exists', () => {
    expect(formatExerciseStat({ sets: 3, reps: '"12/side"', durationMin: 5 })).toBe('3 × 12/side');
    expect(formatExerciseStat({ sets: 3, reps: null, durationMin: 0.5 })).toBe('3 × 30 sec');
    expect(formatExerciseStat({ sets: 2, reps: null, durationMin: 0 })).toBe('2 sets');
    expect(formatExerciseStat({ sets: null, reps: null, durationMin: 2 })).toBe('2 min');
    expect(formatExerciseStat({ sets: null, reps: null, durationMin: null })).toBe('—');
  });
});
