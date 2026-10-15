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
 *      session-length durations and broke for any short exercise — most
 *      visibly isometric holds, which rounded to 0 (shown as 1 min) or up
 *      to 5. RESOLVED (Vervein decision, 2026-10-14, product owner): blocks
 *      under SHORT_BLOCK_MINUTES round to the nearest half minute, never
 *      below one half; longer blocks keep the documented 5-minute rounding.
 */

import type { Exercise, ScaledExercise, ScaledExerciseList, VolumeStance } from '@/lib/engine/types';
import type { EnergyModifierRow } from '@/lib/engine/reference/energy-modifier-table';
import type { SymptomOverrideRow } from '@/lib/engine/reference/symptom-override-table';

// Under this, a block rounds to the nearest half minute (see note 2 above):
// a 45-second plank stays 45 seconds instead of becoming 1 or 5 minutes.
const SHORT_BLOCK_MINUTES = 10;

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
      const rawMinutes = ex.base_duration_min * durationMult;
      adapted_duration_min =
        rawMinutes < SHORT_BLOCK_MINUTES
          ? Math.max(0.5, Math.round(rawMinutes * 2) / 2)
          : Math.round(rawMinutes / 5) * 5;
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

  // KNOWN IMPRECISION (verbatim vault math, not a Vervein-introduced bug):
  // adapted_sets' own Math.max(1, ...) floor above means any exercise with
  // base_sets=1 always reports a 100%+ ratio here regardless of how low the
  // real multiplier was — you can't meaningfully deliver "0.4 sets," so
  // flooring to 1 is the honest minimum, but it pulls the reported "% of
  // baseline" up for sessions containing single-set exercises. A real,
  // observable inaccuracy in what overallSetsPct claims, inherited from the
  // source spec rather than introduced here.
  const ratios = filteredList
    .map((ex, i) => {
      const adapted = scaled[i].adapted_sets;
      return ex.base_sets !== null && adapted !== null ? adapted / ex.base_sets : null;
    })
    .filter((r): r is number => r !== null);
  const overallSetsPct = ratios.length > 0 ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : 100;

  return { kind: 'scaled', exercises: scaled, overallSetsPct, knownGaps };
}
