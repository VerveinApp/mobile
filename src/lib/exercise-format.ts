/**
 * How an exercise's volume reads everywhere it's shown (the session list,
 * the swap sheet, the plan preview, the done-screen summary) — one place, so
 * the same exercise never reads two ways on two screens.
 */

type ExerciseVolume = { sets: number | null; reps: number | string | null; durationMin: number | null };

/** 481 library entries carry their rep text wrapped in literal quotes
 * ('"8/side"'), some with only the opening one — shown without them. */
export function cleanReps(reps: number | string | null): string | null {
  if (reps === null) return null;
  const text = String(reps).replace(/^"+|"+$/g, '').trim();
  return text === '' ? null : text;
}

/** "30 sec", "1 min", "1.5 min" — a short hold reads in seconds instead of
 * a rounded-up minute. */
export function formatExerciseMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  const rounded = Math.round(minutes * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} min`;
}

/**
 * Discrete exercises show "3 × 10". Isometric holds carry a real sets count
 * but no rep count (base_reps is null by design — a plank doesn't have
 * reps), so those fall back to "3 × 1 min" using the real duration instead
 * of fabricating a rep number. Loaded carries can lack a sets count
 * entirely, falling back further to just the duration. Never invents a
 * number plan-preview.ts didn't actually produce — and a duration of
 * exactly 0 is treated the same as no duration at all, since that's
 * volume-scaling.ts's rounding gap, not real information.
 */
export function formatExerciseStat(exercise: ExerciseVolume): string {
  const reps = cleanReps(exercise.reps);
  if (exercise.sets !== null && reps !== null) return `${exercise.sets} × ${reps}`;
  if (exercise.sets !== null && exercise.durationMin) return `${exercise.sets} × ${formatExerciseMinutes(exercise.durationMin)}`;
  if (exercise.sets !== null) return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'}`;
  if (exercise.durationMin) return formatExerciseMinutes(exercise.durationMin);
  return '—';
}
