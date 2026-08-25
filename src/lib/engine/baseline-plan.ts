// M3 — Baseline Plan Module (includes Workout Generator logic).
// Ported verbatim (logic unchanged, only import paths adjusted) from the
// adaptive-engine research vault's src/modules/m3-baseline-plan.ts.
//
// PORT SCOPE NOTE: this app's port stops at M3/M6/M18 — the condition/symptom
// gating modules (M2 Condition Profile, M5 Constraint Resolution) have not
// been ported, since two Chief Architect Audit findings are still open
// against them: unvalidated hard-safety filters (arthritis / chronic
// back-knee-pain exclusions shipping ahead of their own validation process)
// and a missing consent-schema for the health data conditions depend on.
// generateBaselinePlan is always called from this app with `conditions`,
// `standingSymptomTags`, and `movementRestrictions` as empty arrays — the
// onboardingConstraints() logic below still runs (so this stays a faithful,
// unmodified port) but produces no exclusions from those dimensions, since
// there's nothing in the sets to iterate. See onboarding-to-engine.ts.
//
// Builds the user's standing session once, at onboarding, by reusing M6's
// filtering logic with an onboarding-time constraint set — no daily
// energy/acute-symptom layer applied — per Workout Generator.md's explicit
// rationale for not building a second, parallel assembly system.
//
// COMPOSITION (Founder Decision, 2026-07-22 — see the vault's Decision Log):
// "N exercises per focus area, where N is a configurable policy parameter"
// (currently 2, in reference/policy-parameters.ts — a policy value, not an
// architectural constant). Interpretation recorded with the decision:
//  · a "full" focus selection expands to [upper, lower, core] — it means
//    "train everything," not "one area named full";
//  · a body_area:"full" exercise is eligible to fill any area's slot (it
//    trains that area), used when the area's own pool runs short;
//  · selection is deterministic: numeric library order within each area.
//
// DISCLOSED DIVERGENCE (Vervein addition, not in the vault): for
// profile.experience === 'just-starting', the "numeric library order" above
// is reordered by bySelectionOrder() to sort `complexity:'simple'`
// exercises ahead of `moderate` ones first, falling back to numeric ID as
// the tiebreak — still fully deterministic, just experience-weighted. This
// is a Gate 2-style preference, not a Gate 1 safety rule: it changes which
// legal exercise fills a slot first, never removes an exercise from
// eligibility, so it can't produce the empty-pool failure a hard filter
// could. See exercise-filtering.ts for the matching gap-fill-side bias and
// onboarding-to-engine.ts for the experience → bias mapping.
//
// Standing symptom tags apply here (onboarding-collected, active every day);
// conditions apply here too — contraindications are a hard Gate 1 exclusion
// from the very first plan (founder-approved amendment, 2026-07-22).

import type {
  BaselinePlan,
  ConstraintProfile,
  EffectiveConstraintSet,
  Equipment,
  Exercise,
  FocusArea,
  Intensity,
  SessionDay,
  BodyArea,
  MovementPattern,
  Impact,
} from './types';
import { SYMPTOM_OVERRIDE_TABLE } from './reference/symptom-override-table';
import { EXERCISES_PER_FOCUS_AREA } from './reference/policy-parameters';
import { exerciseLibrary, INTENSITY_RANK, IMPACT_RANK, byNumericId, bySelectionOrder } from './exercise-library';
import { filterAndSubstitute } from './exercise-filtering';

export type OnboardingContext = {
  targetIntensity: Intensity;
  equipment: Equipment;
  focusAreas: FocusArea[];
  sessionDays: SessionDay[];
  conditionProfile: ConstraintProfile;
  conditions: string[]; // founder-approved amendment — contraindications apply from the first plan
  standingSymptomTags: string[];
  movementRestrictions: string[];
  // SOFT EXPERIENCE BIAS (Vervein addition, not in the vault — see the
  // COMPOSITION comment below and exercise-filtering.ts's matching header
  // note for the full rationale). true for profile.experience ===
  // 'just-starting'; sorts `complexity:'simple'` exercises ahead of
  // `moderate` ones before the per-area walk below. Never removes a
  // `moderate` exercise from eligibility — see bySelectionOrder.
  biasSimpleExercises: boolean;
};

/**
 * The onboarding-time constraint set: the same categorical dimensions M5
 * computes daily, minus the daily layers (no energy row, no acute tags).
 * targetIntensity acts as the intensity ceiling — the engine's ranked-ceiling
 * semantics ("drawing from the low-intensity tier", Baseline Plan.md).
 * Conditional overrides (period's energy-gated rule) cannot apply here: there
 * is no energy score at onboarding, and period is acute-only regardless.
 */
function onboardingConstraints(ctx: OnboardingContext): EffectiveConstraintSet {
  let impactCeiling: Impact = ctx.conditionProfile.impactCeiling;
  let intensityCeiling: Intensity = ctx.targetIntensity;
  const excludeBodyAreas = new Set<BodyArea>();
  const forceAddTypes = new Set<string>();

  for (const tag of new Set(ctx.standingSymptomTags)) {
    const row = SYMPTOM_OVERRIDE_TABLE[tag];
    if (!row) {
      throw new Error(`M3: unrecognized standing symptom tag "${tag}" — rejected, never silently passed through.`);
    }
    if (row.intensityOverride && INTENSITY_RANK[row.intensityOverride] < INTENSITY_RANK[intensityCeiling]) {
      intensityCeiling = row.intensityOverride;
    }
    if (row.impactOverride && IMPACT_RANK[row.impactOverride] < IMPACT_RANK[impactCeiling]) {
      impactCeiling = row.impactOverride;
    }
    row.excludeBodyAreas?.forEach((a) => excludeBodyAreas.add(a));
    if (row.forceAddType) forceAddTypes.add(row.forceAddType);
  }

  return {
    intensityCeiling,
    impactCeiling,
    equipmentCeiling: ctx.equipment,
    excludeBodyAreas: [...excludeBodyAreas],
    excludeMovementPatterns: [...new Set(ctx.movementRestrictions)] as MovementPattern[],
    forceAddTypes: [...forceAddTypes],
    excludeContraindicatedFor: [...new Set(ctx.conditions)],
  };
}

/**
 * `userId` is not present in the frozen Interface Specification's
 * onboardingContext — the session/user-scoping gap logged for M1 in the
 * vault's Implementation Discoveries. Accepted as a documented extra parameter.
 */
export function generateBaselinePlan(ctx: OnboardingContext, userId: string): BaselinePlan {
  const constraints = onboardingConstraints(ctx);

  // Reuse M6 — the whole point of Workout Generator.md. The candidate "plan"
  // is the full active library; M6's filter keeps what the onboarding-time
  // constraint set permits (gap-fill no-ops by construction: every library
  // exercise is already a candidate).
  const allActive = exerciseLibrary.all().filter((e) => e.active).sort(byNumericId);
  const candidatePlan: BaselinePlan = {
    userId,
    sessionDays: ctx.sessionDays,
    exerciseIds: allActive.map((e) => e.id),
    targetIntensity: ctx.targetIntensity,
    equipment: ctx.equipment,
    focusAreas: ctx.focusAreas,
  };
  const { filtered } = filterAndSubstitute(candidatePlan, constraints, ctx.biasSimpleExercises);
  const eligible = [...filtered].sort(bySelectionOrder(ctx.biasSimpleExercises));

  // --- Composition (Founder Decision): N per focus area. ---
  const areaTargets: BodyArea[] = ctx.focusAreas.includes('full')
    ? ['upper', 'lower', 'core']
    : [...new Set(ctx.focusAreas)] as BodyArea[];

  const chosen: Exercise[] = [];
  const chosenIds = new Set<string>();
  for (const area of areaTargets) {
    let taken = 0;
    // First pass: the area's own pool. Second pass: full-body exercises can
    // fill any area's remaining slots (they train that area).
    for (const pool of [eligible.filter((e) => e.body_area === area), eligible.filter((e) => e.body_area === 'full')]) {
      for (const ex of pool) {
        if (taken >= EXERCISES_PER_FOCUS_AREA) break;
        if (chosenIds.has(ex.id)) continue;
        chosen.push(ex);
        chosenIds.add(ex.id);
        taken++;
      }
      if (taken >= EXERCISES_PER_FOCUS_AREA) break;
    }
    // A short area (library exhausted under constraints) yields fewer than N —
    // returned honestly, never padded from outside the composition rule.
  }

  let exerciseIds = chosen.map((e) => e.id);

  if (exerciseIds.length === 0) {
    // Documented failure mode: constraints alone leave zero eligible exercises
    // even before any daily layer exists — fall back to the same universal
    // recovery pair M7 names, so Decision Invariant #1 holds from the very
    // first plan.
    exerciseIds = ['ex_1023', 'ex_1083'];
  }

  return {
    userId,
    sessionDays: ctx.sessionDays,
    exerciseIds,
    targetIntensity: ctx.targetIntensity,
    equipment: ctx.equipment,
    focusAreas: ctx.focusAreas,
  };
}
