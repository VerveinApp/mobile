/**
 * M5 — Constraint Resolution Module (Gate 1 assembly), ported verbatim from
 * the adaptive-engine research vault's src/modules/m5-constraint-resolution.ts.
 * Computes the day's EffectiveConstraintSet via Most Restrictive Wins:
 * start from the loosest ceiling, only ever tighten it, never loosen.
 *
 * This is what makes today's check-in actually re-filter the exercise pool
 * (via exercise-filtering.ts, called a second time with this daily set)
 * instead of only scaling sets/duration of whatever the onboarding-time
 * baseline pool happened to contain. Without this, a low-energy day could
 * still surface a high-intensity exercise it should have excluded — the gap
 * plan-preview.ts closes by calling this before volume-scaling.ts.
 *
 * SCOPE NOTE, same as elsewhere in this port — standingSymptomTags,
 * movementRestrictions, and conditions are always called with empty arrays
 * (no symptom/condition intake in this app yet), so those branches are dead
 * code today, ported anyway for fidelity to the governed source and to keep
 * the function signature honest about what it actually accepts.
 */

import { IMPACT_RANK, INTENSITY_RANK } from '@/lib/engine/exercise-library';
import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import { SYMPTOM_OVERRIDE_TABLE } from '@/lib/engine/reference/symptom-override-table';
import type {
  BodyArea,
  ConstraintProfile,
  DailyCheckIn,
  EffectiveConstraintSet,
  Equipment,
  Impact,
  Intensity,
  MovementPattern,
} from '@/lib/engine/types';

const CANONICAL_MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  'squat', 'hinge', 'push', 'pull', 'carry', 'plank',
  'rotate', 'jump', 'overhead', 'kneel', 'floor', 'run',
];

function tighterIntensity(a: Intensity, b: Intensity): Intensity {
  return INTENSITY_RANK[a] <= INTENSITY_RANK[b] ? a : b;
}
function tighterImpact(a: Impact, b: Impact): Impact {
  return IMPACT_RANK[a] <= IMPACT_RANK[b] ? a : b;
}

export function computeEffectiveConstraints(
  checkIn: DailyCheckIn,
  conditionProfile: ConstraintProfile,
  standingSymptomTags: string[],
  movementRestrictions: string[],
  equipment: Equipment,
  conditions: string[]
): EffectiveConstraintSet {
  const energyRow = ENERGY_MODIFIER_TABLE[checkIn.energyScore];

  for (const r of movementRestrictions) {
    if (!CANONICAL_MOVEMENT_PATTERNS.includes(r as MovementPattern)) {
      throw new Error(`M5: unrecognized movement restriction "${r}" — rejected at the Gate 1 boundary, never silently passed through.`);
    }
  }

  let intensityCeiling: Intensity = 'high';
  let impactCeiling: Impact = 'high';
  const excludeBodyAreas = new Set<BodyArea>();
  const excludeMovementPatterns = new Set<MovementPattern>(movementRestrictions as MovementPattern[]);
  const forceAddTypes = new Set<string>();

  intensityCeiling = tighterIntensity(intensityCeiling, energyRow.intensityCeiling);
  impactCeiling = tighterImpact(impactCeiling, energyRow.impactCeiling);

  impactCeiling = tighterImpact(impactCeiling, conditionProfile.impactCeiling);

  const activeTags = new Set<string>([...standingSymptomTags, ...checkIn.acuteSymptomTags]);
  for (const tag of activeTags) {
    const row = SYMPTOM_OVERRIDE_TABLE[tag];
    if (!row) {
      throw new Error(`M5: unrecognized symptom tag "${tag}" — rejected at the Gate 1 boundary, never silently passed through.`);
    }
    if (row.intensityOverride) intensityCeiling = tighterIntensity(intensityCeiling, row.intensityOverride);
    if (row.conditionalIntensityOverride && checkIn.energyScore < row.conditionalIntensityOverride.ifEnergyBelow) {
      intensityCeiling = tighterIntensity(intensityCeiling, row.conditionalIntensityOverride.then);
    }
    if (row.impactOverride) impactCeiling = tighterImpact(impactCeiling, row.impactOverride);
    row.excludeBodyAreas?.forEach((a) => excludeBodyAreas.add(a));
    if (row.forceAddType) forceAddTypes.add(row.forceAddType);
  }

  return {
    intensityCeiling,
    impactCeiling,
    equipmentCeiling: equipment,
    excludeBodyAreas: [...excludeBodyAreas],
    excludeMovementPatterns: [...excludeMovementPatterns],
    forceAddTypes: [...forceAddTypes],
    excludeContraindicatedFor: [...new Set(conditions)],
  };
}
