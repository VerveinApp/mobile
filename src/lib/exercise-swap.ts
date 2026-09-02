/**
 * Vervein addition, not in the vault — mid-workout exercise swap. Scope is
 * deliberately narrow: same category only (shared movement pattern + exact
 * body area), filtered through the day's real EffectiveConstraintSet
 * (exercise-filtering.ts's own passesConstraints — the identical Gate 1 rule
 * that already governed which exercises could appear in today's session at
 * all), so a swap can never surface something today's own filtering pass
 * would have excluded — no separate, looser rule invented for this feature.
 * No preference-learning layer: nothing about a swap is persisted or fed
 * back into future sessions, it's a same-session substitution only.
 */

import { exerciseLibrary } from '@/lib/engine/exercise-library';
import { passesConstraints } from '@/lib/engine/exercise-filtering';
import type { EffectiveConstraintSet, Exercise } from '@/lib/engine/types';
import { isTrainableExercise } from '@/lib/non-trainable-exercises';
import type { PlanExercise } from '@/lib/plan-preview';

/**
 * Candidates share the current exercise's exact body area and at least one
 * movement pattern, pass today's real constraint set, and aren't already
 * somewhere else in today's session (`excludeIds` — every exercise currently
 * in the plan, swapped-in replacements included, so a swap can't duplicate
 * an exercise the person is already doing today). Sorted alphabetically —
 * a plain picker list, not a ranked recommendation (no preference layer).
 */
export function getSwapCandidates(
  current: PlanExercise,
  constraints: EffectiveConstraintSet,
  excludeIds: string[]
): Exercise[] {
  const currentFull = exerciseLibrary.getById(current.id);
  if (!currentFull) return [];
  const excludeSet = new Set(excludeIds);
  return exerciseLibrary
    .all()
    .filter(
      (ex) =>
        ex.active &&
        !excludeSet.has(ex.id) &&
        ex.body_area === currentFull.body_area &&
        ex.movement_patterns.some((p) => currentFull.movement_patterns.includes(p)) &&
        passesConstraints(ex, constraints) &&
        isTrainableExercise(ex.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds the replacement PlanExercise a chosen candidate becomes once
 * swapped in. Reps are never scaled anywhere in this codebase (volume-
 * scaling.ts's own scaleVolume always passes base_reps through unchanged),
 * so the candidate's base_reps carries over as-is, same as every other
 * exercise in the session. Sets/duration ARE scaled today — rather than
 * re-deriving the full energy × symptom × calibration × health-readiness
 * multiplier chain a second time here, this reads the ratio already visible
 * on screen (today's adapted figure over that same exercise's own base
 * figure) and applies it to the candidate's base figures, using the exact
 * same Math.max(1, Math.round(...)) / 5-minute-rounding formulas scaleVolume
 * itself uses — an equivalent result, not a separate scaling policy.
 * `originalFull` is the pre-swap exercise's full library record (for its
 * base_sets/base_duration_min); `original` is that same exercise's already-
 * adapted PlanExercise as delivered by today's real plan.
 */
export function buildSwapReplacement(
  candidate: Exercise,
  original: PlanExercise,
  originalFull: Exercise | null
): PlanExercise {
  const setsRatio =
    originalFull?.base_sets && original.sets !== null ? original.sets / originalFull.base_sets : 1;
  const durationRatio =
    originalFull?.base_duration_min && original.durationMin !== null
      ? original.durationMin / originalFull.base_duration_min
      : 1;
  const sets = candidate.base_sets !== null ? Math.max(1, Math.round(candidate.base_sets * setsRatio)) : null;
  const durationMin =
    candidate.base_duration_min !== null ? Math.round((candidate.base_duration_min * durationRatio) / 5) * 5 : null;
  return {
    name: candidate.name,
    sets,
    reps: candidate.base_reps,
    durationMin,
    bodyArea: candidate.body_area,
    repStructure: candidate.rep_structure,
    intensity: candidate.intensity,
    isCompound: candidate.is_compound,
    id: candidate.id,
  };
}
