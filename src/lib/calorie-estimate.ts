import type { Intensity } from '@/lib/engine/types';

// Standard MET (metabolic equivalent) values by the library's own three-
// value intensity taxonomy — not a fabricated per-exercise number, and not
// a single flat per-session average either. Every one of the 1,449 library
// exercises already carries one of these three values (see
// exercise-library.ts's own CANONICAL_INTENSITY), so this needs exactly
// three constants, not one per exercise. Values are conservative,
// population-level MET estimates for bodyweight/resistance work at each
// tier — a real number, not a precise one; see estimateCaloriesBurned's own
// doc comment for how that's communicated to the user.
const MET_BY_INTENSITY: Record<Intensity, number> = {
  low: 2.5,
  medium: 4.5,
  high: 6.5,
};

export type CompletedExerciseForCalorieEstimate = {
  intensity: Intensity | null;
  durationMin: number | null;
};

/**
 * Active-energy estimate for a session, summed per completed exercise using
 * its own real intensity and adapted duration rather than one number for
 * the whole session — a session mixing a couple of high-intensity compounds
 * with some low-intensity mobility work gets a real total, not an average
 * across everything. Standard MET formula: kcal/min = MET * 3.5 *
 * weightKg / 200. Deliberately does NOT use Mifflin-St Jeor/BMR (that
 * estimates *daily resting* burn from weight+height+age+sex — a different
 * metric answering a different question) — a single workout's active
 * energy only ever needed weight, which this app already collects.
 * Null intensity (a real, small share of the library) falls back to the
 * medium bucket rather than dropping that exercise's minutes entirely,
 * since real time and effort still went into it.
 *
 * Always an estimate, never presented as measured — see check-in.tsx's own
 * "~XXX cal, estimated" copy where this is displayed.
 */
export function estimateCaloriesBurned(
  exercises: CompletedExerciseForCalorieEstimate[],
  weightKg: number
): number {
  let totalKcal = 0;
  for (const exercise of exercises) {
    const met = MET_BY_INTENSITY[exercise.intensity ?? 'medium'];
    const minutes = exercise.durationMin ?? 0;
    totalKcal += ((met * 3.5 * weightKg) / 200) * minutes;
  }
  return Math.round(totalKcal);
}
