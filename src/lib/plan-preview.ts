/**
 * The real adaptive engine, ported in from the research vault (see
 * src/lib/engine/ and src/lib/onboarding-to-engine.ts). Runs the actual
 * daily pipeline the vault's own M13 (Adaptation Orchestrator) sequences —
 * not a re-invention of it, the same steps in the same order:
 *
 *   1. Map the user's profile into the engine's OnboardingContext
 *      (onboarding-to-engine.ts) and generate the standing baseline plan
 *      (baseline-plan.ts).
 *   2. Re-derive TODAY's EffectiveConstraintSet from the check-in's energy
 *      score (constraint-resolution.ts, M5) and re-run M6 filtering against
 *      it (exercise-filtering.ts). This is what lets a low-energy day
 *      actually exclude too-intense exercises from the pool, not just do
 *      less of the same ones — the baseline-time filter alone can't do this,
 *      since it has no energy score yet.
 *   3. Check the Fallback trigger (fallback-logic.ts, M7): an empty pool or
 *      Energy Score 1 always resolves to the same two always-available
 *      recovery exercises, never an invented minimum session.
 *   4. Otherwise, scale sets/duration per exercise by the real multiplier
 *      chain — energy × calibration, no symptom/condition multipliers since
 *      this app doesn't collect those yet (volume-scaling.ts, M8).
 *   5. Assemble the session and compute total duration honestly — only
 *      summing exercises that actually carry a duration figure, never
 *      inventing one for the rest (workout-assembly.ts, M10).
 *   6. Build the explanation from the real per-energy templates plus a
 *      calibration-aware line, replacing the old hand-written 5-line table
 *      (explanation-string.ts, M11).
 *
 * SCOPE NOTE — `goal` isn't read here, on purpose, not as an oversight. The
 * vault's own engine treats `primaryGoal` as "cosmetic only — never read by
 * any Layer 3 module" (a founder-reviewed decision) — exercise selection is
 * driven by equipment ceiling, intensity ceiling, focus areas, and today's
 * energy, not by which of the four marketing-facing goals the user picked.
 *
 * SCOPE NOTE — symptom-tag and condition-profile gating (M2, the TAG_LINES
 * half of M11, and the symptom/condition terms in M5/M8's multiplier chains)
 * stay unported: this app collects no symptom or condition data yet, so
 * those parameters are always passed as empty arrays / neutral defaults.
 * See onboarding-to-engine.ts and baseline-plan.ts for the same boundary.
 */

import { generateBaselinePlan } from '@/lib/engine/baseline-plan';
import { computeEffectiveConstraints } from '@/lib/engine/constraint-resolution';
import { buildExplanation } from '@/lib/engine/explanation-string';
import { filterAndSubstitute } from '@/lib/engine/exercise-filtering';
import { checkFallbackTrigger } from '@/lib/engine/fallback-logic';
import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import type { DailyCheckIn, Exercise, ScaledExerciseList, UserCalibration } from '@/lib/engine/types';
import { scaleVolume } from '@/lib/engine/volume-scaling';
import { assembleWorkout } from '@/lib/engine/workout-assembly';
import { localDateStr } from '@/lib/local-date';
import { LOCAL_USER_ID, profileToOnboardingContext } from '@/lib/onboarding-to-engine';
import { ENVIRONMENT_LABELS } from '@/lib/profile-labels';
import type { UserProfile } from '@/lib/user-profile';

/** Matches EnergyGauge's EnergyScore exactly — the full 1–5 check-in scale. */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type PlanPreviewInput = UserProfile;

/** Re-exported from the engine so existing consumers (workout-log.ts) don't
 * need to know the real taxonomy moved — same four values either way. */
export type { BodyArea } from '@/lib/engine/types';

export type PlanExercise = {
  name: string;
  /** null for exercises the library defines by duration alone (isometric holds, loaded carries) — never a fabricated set count. */
  sets: number | null;
  reps: number | string | null;
  /** null for discrete sets×reps exercises — see M10's own honesty note on totalDuration below. */
  durationMin: number | null;
  bodyArea: Exercise['body_area'];
};

export type PlanPreviewResult = {
  exerciseCount: number;
  durationMin: number;
  explanation: string;
  /** Real, from the user's actual equipment answer. */
  equipmentNote: string;
  exercises: PlanExercise[];
};

export function computePlanPreview(
  input: PlanPreviewInput,
  energy: EnergyLevel,
  calibration: UserCalibration
): PlanPreviewResult {
  const ctx = profileToOnboardingContext(input);
  const baselinePlan = generateBaselinePlan(ctx, LOCAL_USER_ID);

  // Step 2 — today's constraint set, re-filtered against the baseline pool.
  const checkIn: DailyCheckIn = {
    userId: LOCAL_USER_ID,
    date: localDateStr(),
    energyScore: energy,
    acuteSymptomTags: [],
    skipped: false,
  };
  const dailyConstraints = computeEffectiveConstraints(
    checkIn,
    ctx.conditionProfile,
    ctx.standingSymptomTags,
    ctx.movementRestrictions,
    ctx.equipment,
    ctx.conditions
  );
  const filterResult = filterAndSubstitute(baselinePlan, dailyConstraints);

  // Step 3 — Fallback check.
  const fallback = checkFallbackTrigger(filterResult.filtered.length, energy, false);

  let assembledExercises: ScaledExerciseList | [Exercise, Exercise];
  let isRestDay = false;
  let overallSetsPct = 100;

  if (fallback) {
    assembledExercises = fallback.exercises;
    isRestDay = true;
  } else {
    // Step 4 — volume scaling. energyModifier.setsMultiplier is 0 at
    // Energy Score 1, but that path is already fully claimed by Fallback
    // above, so this only ever runs for 2–5.
    const energyModifier = ENERGY_MODIFIER_TABLE[energy];
    const volumeResult = scaleVolume(filterResult.filtered, energyModifier, [], ctx.conditionProfile.volumeStance, calibration.multiplier);

    if (volumeResult.kind === 'stacking-transition-signal') {
      // Unreachable today — volume-scaling.ts's own FD-3 gap always evaluates
      // this false — but handled for type-safety and so this stays a
      // faithful mirror of M13's real branch if that gap is ever resolved.
      const secondFallback = checkFallbackTrigger(filterResult.filtered.length, energy, true)!;
      assembledExercises = secondFallback.exercises;
      isRestDay = true;
    } else {
      assembledExercises = volumeResult.exercises;
      overallSetsPct = volumeResult.overallSetsPct;
    }
  }

  // Step 5 — assembly (honest totalDuration).
  const { workout } = assembleWorkout(assembledExercises, isRestDay);

  // Step 6 — explanation. activeTags is always [] (see this file's scope note).
  const { explanation } = buildExplanation(energy, [], calibration, assembledExercises, workout.totalDuration, overallSetsPct);

  // ScaledExercise doesn't carry body_area — zip against filterResult.filtered
  // by index rather than a second by-id lookup, since scaleVolume's map()
  // preserves order 1:1 over exactly that list. The Fallback branch already
  // returns full Exercise objects, which carry body_area directly.
  const exercises: PlanExercise[] = assembledExercises.map((ex, i) => {
    if ('exerciseId' in ex) {
      return {
        name: ex.name,
        sets: ex.adapted_sets,
        reps: ex.adapted_reps,
        durationMin: ex.adapted_duration_min,
        bodyArea: filterResult.filtered[i]?.body_area ?? 'full',
      };
    }
    return {
      name: ex.name,
      sets: ex.base_sets,
      reps: ex.base_reps,
      durationMin: ex.base_duration_min,
      bodyArea: ex.body_area,
    };
  });

  const equipmentNote = `Selected from your ${ENVIRONMENT_LABELS[input.environment ?? ''] ?? 'equipment'} setup.`;

  return {
    exerciseCount: exercises.length,
    durationMin: workout.totalDuration,
    explanation,
    equipmentNote,
    exercises,
  };
}
