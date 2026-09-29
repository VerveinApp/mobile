// Frozen reference data — ported verbatim from the adaptive-engine research
// vault's src/reference/symptom-override-table.ts (traces to "Symptom Tags.md"'s
// Symptom Override Table). Data only. All ten tags represented.
//
// Live and exercised at runtime: constraint-resolution.ts's own
// computeEffectiveConstraints (M5) reads this table for every real check-in
// via plan-preview.ts, over whatever acute symptom tags the user actually
// picked that day (see symptom-tags.ts's own SYMPTOM_TAGS) — this comment
// used to say M5 hadn't been ported yet; it has been since.
//
// SYMPTOM_OVERRIDE_TABLE is keyed by the canonical SymptomTag union (not a
// bare string) so that adding a new tag to symptom-tags.ts without a
// matching row here is a compile error — computeEffectiveConstraints itself
// still throws on an unrecognized tag at the Gate 1 boundary as its own
// runtime safety net (never silently pass through unrecognized input,
// same rule as movement restrictions get), but that throw should only ever
// be reachable from truly malformed data, not from the two lists simply
// drifting apart (found as a real, if latent, risk in a later full-app
// audit — the two used to have no type-level link keeping them in sync).
import type { Intensity, Impact, BodyArea } from '../types';
import type { SymptomTag } from '@/lib/symptom-tags';

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

export const SYMPTOM_OVERRIDE_TABLE: Record<SymptomTag, SymptomOverrideRow> = {
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
