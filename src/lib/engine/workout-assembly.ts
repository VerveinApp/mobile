/**
 * M10 — Workout Assembly Module (Gate 3), ported verbatim from the
 * adaptive-engine research vault's src/modules/m10-workout-assembly.ts.
 *
 * Replaces plan-preview.ts's old `ex.base_duration_min ?? 5` — which
 * invented a 5-minute placeholder for any exercise missing real duration
 * data — with the real, honest formula: totalDuration only sums exercises
 * that actually carry a duration field, and flags (rather than guesses at)
 * how many discrete sets×reps exercises aren't counted, per the source
 * project's own documented, still-open gap. In practice this barely bites in
 * this app: 1,444 of 1,449 library exercises now carry a real
 * base_duration_min (tier-derived where not individually authored, per the
 * library's own backfill), so the flagged case is the rare exception, not
 * the common path — but it's still a real gap, not silently patched over.
 */

import type { AdaptedWorkout, Exercise, ScaledExerciseList } from '@/lib/engine/types';

export function assembleWorkout(
  exerciseList: ScaledExerciseList | [Exercise, Exercise],
  isRestDay: boolean
): { workout: AdaptedWorkout; knownGaps: string[] } {
  if (exerciseList.length < 2) {
    throw new Error('M10: contract violation — assembleWorkout received fewer than 2 exercises. Upstream (M6/M7) should never allow this.');
  }

  const knownGaps: string[] = [];
  let totalDuration = 0;
  let discreteWithNoDuration = 0;

  for (const ex of exerciseList) {
    const dur = 'adapted_duration_min' in ex ? ex.adapted_duration_min : ex.base_duration_min;
    if (dur !== null && dur !== undefined) {
      totalDuration += dur;
    } else {
      discreteWithNoDuration++;
    }
  }

  if (discreteWithNoDuration > 0) {
    knownGaps.push(
      `totalDuration only sums exercises with a duration field (isometric_hold/loaded_carry). ${discreteWithNoDuration} discrete (sets×reps) exercise(s) in this session have no governance-specified formula for their contribution to total session minutes — an open implementation question, not resolved here.`
    );
  }

  return {
    workout: { exercises: exerciseList, totalDuration, isRestDay },
    knownGaps,
  };
}
