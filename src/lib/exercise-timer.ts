import type { PlanExercise } from '@/lib/plan-preview';

const SECONDS_PER_REP = 3;
const REST_BETWEEN_SETS_SECONDS = 45;
const DEFAULT_REPS_WHEN_UNPARSEABLE = 10;

/**
 * Per-exercise timer length, in seconds, for check-in.tsx's guided session
 * flow. Duration-bearing exercises (isometric holds, loaded carries) use
 * their real adapted_duration_min — that's real engine output, not a guess.
 * Discrete sets×reps exercises have no duration figure by design (see
 * workout-assembly.ts's own honesty note — this app doesn't invent one
 * there), so this computes a clearly-an-estimate figure instead, using the
 * same "Est." framing train.tsx already uses for projected numbers: ~3
 * seconds per rep plus a 45-second rest between sets, a common coaching
 * rule of thumb, not fabricated per-exercise data. `reps` can be a range
 * string like "10-12/side" — the first number found is used; unparseable
 * values fall back to a flat 10, same spirit as formatExerciseStat's own
 * "never invent a number, but never crash either" handling.
 */
export function getExerciseTimerSeconds(exercise: PlanExercise): number {
  if (exercise.durationMin) return exercise.durationMin * 60;

  const sets = exercise.sets ?? 1;
  let reps = DEFAULT_REPS_WHEN_UNPARSEABLE;
  if (typeof exercise.reps === 'number') {
    reps = exercise.reps;
  } else if (typeof exercise.reps === 'string') {
    const match = exercise.reps.match(/\d+/);
    if (match) reps = parseInt(match[0], 10);
  }

  const workSeconds = sets * reps * SECONDS_PER_REP;
  const restSeconds = Math.max(0, sets - 1) * REST_BETWEEN_SETS_SECONDS;
  return Math.max(20, workSeconds + restSeconds);
}

export function formatTimerClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
