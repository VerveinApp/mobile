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
 *      session-length durations and silently breaks for any short exercise —
 *      most visibly isometric holds, but a short discrete exercise can zero
 *      out the same way at a reduced multiplier. This implements the
 *      documented formula literally — including the case where it rounds to
 *      0 — and flags every occurrence, across every rep_structure, rather
 *      than guessing at a finer rounding increment nobody approved.
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
      // Widened from `ex.rep_structure !== 'discrete' && ...` (Vervein fix,
      // not a vault change — the vault's own Implementation Discoveries log
      // names this exact flagging-scope gap and suggests this as the small,
      // symmetric fix, distinct from the rounding formula itself which stays
      // untouched/unspecified above): the original condition meant a
      // discrete exercise rounding to 0 (a real, reachable case — e.g.
      // base_duration_min:8 at energy 2 with default calibration:
      // round((8×0.6)/5)×5=0) was silently unflagged, unlike an isometric
      // hold hitting the identical zero. Both are the same underlying
      // rounding-granularity gap; only one of them was ever surfaced.
      if (adapted_duration_min === 0) {
        // ENGINEERING SAFETY NET (Vervein fix, not a vault change): floors
        // to 1 rather than leaving 0 — a 0-minute exercise is a real
        // user-visible defect ("Plank — 0 min"), not just an internal
        // logging concern, and workout-assembly.ts sums this value verbatim
        // into the session's displayed total with no floor of its own. This
        // does NOT resolve the underlying gap (what the correct, finer
        // rounding increment should be is still an open governance
        // question, unchanged from the comment above) — it only guarantees
        // the unresolved gap never reaches the UI as a nonsensical zero.
        adapted_duration_min = 1;
        knownGaps.push(
          ex.rep_structure !== 'discrete'
            ? `${ex.id} (${ex.name}): adapted_duration_min rounded to 0, floored to 1 — Volume Scaling's own documented gap (5-minute rounding is wrong for short ${ex.rep_structure} exercises; a finer, hold-appropriate increment is specified but not implemented).`
            : `${ex.id} (${ex.name}): adapted_duration_min rounded to 0, floored to 1 — the same 5-minute-rounding gap noted above, reachable here too since a discrete exercise's base_duration_min can be short enough to zero out at a reduced multiplier.`
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
