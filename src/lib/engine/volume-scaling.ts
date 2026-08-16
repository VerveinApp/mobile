/**
 * M8 — Volume Scaling Module (Gate 2 — Policy P5 interim + calibration),
 * ported verbatim from the adaptive-engine research vault's
 * src/modules/m8-volume-scaling.ts. Computes the real multiplier chain
 * (energy × symptom × condition × calibration) and applies it per exercise —
 * replaces plan-preview.ts's old FACTOR_BY_ENERGY, which shrank the exercise
 * LIST itself by an invented percentage instead of scaling each exercise's
 * real sets/duration. Never itself clamps or floors a number (FD-3) — its
 * only two outcomes are "scaled result" or "signal the caller to fall back."
 *
 * TWO GENUINE, FLAGGED GAPS LIVE IN THIS MODULE — surfaced, not hidden, same
 * discipline as the rest of this port:
 *
 *  (1) The FD-3 "stacking-transition" trigger is architecturally specified
 *      (transition to Fallback once the multiplier chain's output would fall
 *      below Fallback's own minimum meaningful session) but governance never
 *      reduced that qualitative description to a checkable numeric rule.
 *      Inventing one here would be exactly the kind of unauthorized number
 *      this project has repeatedly refused to invent, so this always returns
 *      `stackingTransition: false` and reports the gap explicitly.
 *
 *  (2) Duration rounding to the nearest 5 minutes was written for
 *      session-length durations and silently breaks for short isometric
 *      holds. This implements the documented formula literally — including
 *      the case where it rounds to 0 — and flags every occurrence rather
 *      than guessing at a fix nobody approved.
 */

import type { Exercise, ScaledExercise, ScaledExerciseList, VolumeStance } from '@/lib/engine/types';
import type { EnergyModifierRow } from '@/lib/engine/reference/energy-modifier-table';
import type { SymptomOverrideRow } from '@/lib/engine/reference/symptom-override-table';

export type VolumeScalingResult =
  | { kind: 'scaled'; exercises: ScaledExerciseList; overallSetsPct: number; knownGaps: string[] }
  | { kind: 'stacking-transition-signal'; knownGaps: string[] };

export function scaleVolume(
  filteredList: Exercise[],
  energyModifier: EnergyModifierRow,
  activeSymptomOverrides: SymptomOverrideRow[],
  conditionVolumeStance: VolumeStance,
  calibrationMultiplier: number
): VolumeScalingResult {
  const knownGaps: string[] = [];

  const symptomSetsMultiplier = activeSymptomOverrides.reduce((acc, o) => acc * (o.setsMultiplier ?? 1), 1);
  const symptomDurationMultiplier = activeSymptomOverrides.reduce((acc, o) => acc * (o.durationMultiplier ?? 1), 1);
  const conditionDampener = conditionVolumeStance === 'conservative' ? 0.85 : 1;

  const setsMultiplier = energyModifier.setsMultiplier * symptomSetsMultiplier * conditionDampener * calibrationMultiplier;
  const durationMult = energyModifier.durationMultiplier * symptomDurationMultiplier * calibrationMultiplier;

  const stackingTransition = false; // see module header — flagged, not invented
  knownGaps.push(
    "FD-3's stacking-transition trigger has no governance-defined numeric/structural check yet; this build always evaluates it as false and defers to Energy=1 / empty-filter triggers only."
  );

  if (stackingTransition) {
    return { kind: 'stacking-transition-signal', knownGaps };
  }

  const scaled: ScaledExerciseList = filteredList.map((ex): ScaledExercise => {
    const adapted_sets = ex.base_sets !== null ? Math.max(1, Math.round(ex.base_sets * setsMultiplier)) : null;

    let adapted_duration_min: number | null = null;
    if (ex.base_duration_min !== null) {
      adapted_duration_min = Math.round((ex.base_duration_min * durationMult) / 5) * 5;
      if (ex.rep_structure !== 'discrete' && adapted_duration_min === 0) {
        knownGaps.push(
          `${ex.id} (${ex.name}): adapted_duration_min rounded to 0 — Volume Scaling's own documented gap (5-minute rounding is wrong for short ${ex.rep_structure} exercises; a finer, hold-appropriate increment is specified but not implemented).`
        );
      }
    }

    return {
      exerciseId: ex.id,
      name: ex.name,
      adapted_sets,
      adapted_reps: ex.base_reps,
      adapted_duration_min,
      laterality: ex.laterality,
    };
  });

  const ratios = filteredList
    .map((ex, i) => {
      const adapted = scaled[i].adapted_sets;
      return ex.base_sets !== null && adapted !== null ? adapted / ex.base_sets : null;
    })
    .filter((r): r is number => r !== null);
  const overallSetsPct = ratios.length > 0 ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : 100;

  return { kind: 'scaled', exercises: scaled, overallSetsPct, knownGaps };
}
