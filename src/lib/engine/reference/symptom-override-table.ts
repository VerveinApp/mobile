// Frozen reference data — ported verbatim from the adaptive-engine research
// vault's src/reference/symptom-override-table.ts (traces to "Symptom Tags.md"'s
// Symptom Override Table). Data only. All ten tags represented.
//
// Not yet exercised at runtime by this port: baseline-plan.ts only ever
// calls generateBaselinePlan with an empty standingSymptomTags array (the
// condition/symptom-gating modules — M2, M5 — haven't been ported, see
// baseline-plan.ts's own doc comment), so the lookup loop that reads this
// table never iterates. Ported anyway for fidelity — the type signature
// baseline-plan.ts imports requires it to exist, and an empty/stubbed
// version would silently drift from the governed source it traces to.

import type { Intensity, Impact, BodyArea } from '../types';

export type SymptomOverrideRow = {
  intensityOverride?: Intensity;
  /** Governance conditionals like period's "→ low if energy < 3" — applied by M5 at the daily layer only (onboarding-time merges have no energy score). */
  conditionalIntensityOverride?: { ifEnergyBelow: 1 | 2 | 3 | 4 | 5; then: Intensity };
  impactOverride?: Impact;
  excludeBodyAreas?: BodyArea[];
  forceAddType?: string; // e.g. "mobility" | "recovery" — a type-level force-add
  substituteBodyAreas?: BodyArea[]; // e.g. sore_legs/sore_upper's "Substitute: X + Y"
  setsMultiplier?: number;
  durationMultiplier?: number;
};

export const SYMPTOM_OVERRIDE_TABLE: Record<string, SymptomOverrideRow> = {
  period: {
    conditionalIntensityOverride: { ifEnergyBelow: 3, then: 'low' }, // "→ low if energy < 3"
    impactOverride: 'low',
    forceAddType: 'mobility',
  },
  brain_fog: { durationMultiplier: 0.8 },
  sore_legs: { excludeBodyAreas: ['lower'], substituteBodyAreas: ['upper', 'core'] },
  sore_upper: { excludeBodyAreas: ['upper'], substituteBodyAreas: ['lower', 'core'] },
  stressed: { intensityOverride: 'low', forceAddType: 'recovery' },
  nausea: { intensityOverride: 'low', impactOverride: 'low', forceAddType: 'recovery', durationMultiplier: 0.6 },
  poor_sleep: { intensityOverride: 'medium', durationMultiplier: 0.85 },
  joint_pain: { impactOverride: 'low' },
  dizziness: { impactOverride: 'low' },
  heat_intolerance: { intensityOverride: 'medium' },
};
