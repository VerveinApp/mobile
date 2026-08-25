// M6 — Exercise Filtering & Substitution Module (Gate 1 execution).
// Ported verbatim (logic unchanged, only import paths adjusted) from the
// adaptive-engine research vault's src/modules/m6-exercise-filtering.ts.
// Filters BaselinePlan against EffectiveConstraintSet; gap-fills from the
// full library under the same constraints. This is also where Policy P4's
// documented keep-or-remove interim executes — removed exercises are removed
// wholesale, never modified-in-place (no actuation surface exists per
// Exercise Selection Engine).
//
// 2026-07-22 fixes and founder decisions (see the vault's Decision Log +
// Production Readiness Review):
//  · Contraindication execution (approved amendment): an exercise whose
//    contraindications intersect the user's conditions is hard-excluded,
//    traced as "contraindication".
//  · Full-body rule (FD): any excluded body area also excludes
//    body_area:"full" exercises — they train the excluded area. A side effect
//    (noted in the review as H3): gap-fill candidates now automatically match
//    Symptom Tags' substitute lists (excluding lower+full leaves upper+core).
//  · Force-add execution (H1): gap-fill draws at least one candidate per
//    forceAdd type first, within the removed-slot budget, then fills the rest
//    from the general pool — the documented rule in Exercise Filtering and
//    Substitution.md, previously computed by M5 and never consumed.
//  · Honest trace labels (H4): movement-restriction exclusions are traced as
//    "restriction", never mislabeled "body-area"; inactive baseline exercises
//    are excluded and traced as "inactive" (M2f).
//  · An unresolvable baseline exercise ID throws (M1f) — data corruption is
//    loud, never a silently smaller session.
//
// DISCLOSED DIVERGENCE (Vervein addition, not in the vault): gap-fill
// candidates are ordered by bySelectionOrder(biasSimpleFirst) instead of
// raw library order. For beginners (profile.experience === 'just-starting'),
// this sorts `complexity:'simple'` candidates ahead of `moderate` ones —
// numeric ID stays the tiebreak. It's a preference over which *legal*
// candidate fills a slot first, never a new exclusion: a `moderate`
// exercise remains eligible and can still be chosen if it's the only
// candidate left, so gapFillShortfall behavior is unchanged. See
// baseline-plan.ts's matching header note for the full rationale.
//
// DISCLOSED DIVERGENCE (Vervein addition, not in the vault): both survivor
// selection and gap-fill candidates are additionally required to pass
// isTrainableExercise — see non-trainable-exercises.ts for the real product
// bug this closes (fitness-test/assessment protocols like "Bench Press 1RM
// Test" have no vault-schema field distinguishing them from a real
// exercise, so passesConstraints alone would let one get assigned as an
// actual day's workout exercise). This is a genuine new exclusion, unlike
// the ordering divergence above — traced honestly as 'non-trainable' in
// gate1Exclusions, never folded into an existing (and now inaccurate)
// reason label.

import type { BaselinePlan, EffectiveConstraintSet, Exercise, FilteredExerciseList } from './types';
import { exerciseLibrary, INTENSITY_RANK, IMPACT_RANK, EQUIPMENT_RANK, bySelectionOrder } from './exercise-library';
import { isTrainableExercise } from '../non-trainable-exercises';

function bodyAreaExcluded(ex: Exercise, c: EffectiveConstraintSet): boolean {
  if (c.excludeBodyAreas.includes(ex.body_area)) return true;
  // Full-body FD: full-body work trains every area, so any exclusion covers it.
  return ex.body_area === 'full' && c.excludeBodyAreas.length > 0;
}

function contraindicated(ex: Exercise, c: EffectiveConstraintSet): boolean {
  return ex.contraindications.some((cond) => c.excludeContraindicatedFor.includes(cond));
}

function passesConstraints(ex: Exercise, c: EffectiveConstraintSet): boolean {
  const intensityOk = ex.intensity === null || INTENSITY_RANK[ex.intensity] <= INTENSITY_RANK[c.intensityCeiling];
  const impactOk = IMPACT_RANK[ex.impact] <= IMPACT_RANK[c.impactCeiling];
  const equipmentOk = EQUIPMENT_RANK[ex.equipment] <= EQUIPMENT_RANK[c.equipmentCeiling];
  const patternOk = !ex.movement_patterns.some((p) => c.excludeMovementPatterns.includes(p));
  return intensityOk && impactOk && equipmentOk && !bodyAreaExcluded(ex, c) && patternOk && !contraindicated(ex, c);
}

/** One named source per exclusion, checked in Gate 1 rung order. Only ever
 * called on an exercise that has already failed passesConstraints (or, for
 * 'non-trainable', failed the Vervein-added check below it) — never on one
 * that actually passes, which would fall through to the wrong reason. */
function exclusionReason(
  ex: Exercise,
  c: EffectiveConstraintSet
): FilterResult['gate1Exclusions'][number]['excludedBy'] {
  if (contraindicated(ex, c)) return 'contraindication';
  if (ex.intensity !== null && INTENSITY_RANK[ex.intensity] > INTENSITY_RANK[c.intensityCeiling]) return 'intensity';
  if (IMPACT_RANK[ex.impact] > IMPACT_RANK[c.impactCeiling]) return 'impact';
  if (EQUIPMENT_RANK[ex.equipment] > EQUIPMENT_RANK[c.equipmentCeiling]) return 'equipment';
  if (bodyAreaExcluded(ex, c)) return 'body-area';
  if (!isTrainableExercise(ex.id)) return 'non-trainable';
  return 'restriction'; // the only remaining dimension — movement patterns
}

export type FilterResult = {
  filtered: FilteredExerciseList;
  gate1Exclusions: {
    exerciseId: string;
    excludedBy:
      | 'contraindication'
      | 'intensity'
      | 'impact'
      | 'equipment'
      | 'body-area'
      | 'restriction'
      | 'inactive'
      | 'non-trainable';
  }[];
  gapFillShortfall: number; // > 0 means the library couldn't fill every removed slot — a real, allowed outcome
};

export function filterAndSubstitute(
  baselinePlan: BaselinePlan,
  constraints: EffectiveConstraintSet,
  biasSimpleFirst: boolean = false
): FilterResult {
  const baselineExercises = baselinePlan.exerciseIds.map((id) => {
    const ex = exerciseLibrary.getById(id);
    if (!ex) {
      throw new Error(`M6: baseline plan references unknown exercise "${id}" — a data-integrity failure, never a silently smaller session.`);
    }
    return ex;
  });

  const survivors: Exercise[] = [];
  const gate1Exclusions: FilterResult['gate1Exclusions'] = [];

  for (const ex of baselineExercises) {
    if (!ex.active) {
      gate1Exclusions.push({ exerciseId: ex.id, excludedBy: 'inactive' });
    } else if (passesConstraints(ex, constraints) && isTrainableExercise(ex.id)) {
      survivors.push(ex);
    } else {
      gate1Exclusions.push({ exerciseId: ex.id, excludedBy: exclusionReason(ex, constraints) });
    }
  }

  const removedCount = baselineExercises.length - survivors.length;
  let filled = 0;
  if (removedCount > 0) {
    const survivorIds = new Set(survivors.map((e) => e.id));
    const candidates = exerciseLibrary
      .all()
      .filter((e) => e.active && !survivorIds.has(e.id) && !baselinePlan.exerciseIds.includes(e.id))
      .filter((e) => passesConstraints(e, constraints) && isTrainableExercise(e.id))
      .sort(bySelectionOrder(biasSimpleFirst));

    // Force-add first (H1): at least one candidate per forced type, in the
    // deterministic order M5 emitted them, within the removed-slot budget.
    for (const forcedType of constraints.forceAddTypes) {
      if (filled >= removedCount) break;
      const alreadyHave = survivors.some((e) => e.type === forcedType);
      if (alreadyHave) continue;
      const candidate = candidates.find((e) => e.type === forcedType && !survivors.includes(e));
      if (candidate) {
        survivors.push(candidate);
        filled++;
      }
      // No candidate of the forced type under constraints → nothing is
      // fabricated; the shortfall accounting below stays honest.
    }

    for (const candidate of candidates) {
      if (filled >= removedCount) break;
      if (survivors.includes(candidate)) continue;
      survivors.push(candidate);
      filled++;
    }
  }

  return {
    filtered: survivors,
    gate1Exclusions,
    gapFillShortfall: Math.max(0, removedCount - filled),
  };
}
