/**
 * The eight conditions the research vault's CONDITION_PRIORS table names
 * (engine/reference/ — not ported into this app; see this file's own scope
 * note below for why). Collected here for the same reason the Chief
 * Architect Audit's C3 finding recommends: "collect the data (for later use
 * and for the worksheet's own benefit), but do not let it gate exercise
 * selection until Condition Constraint Worksheet has validated" the
 * highest-priority priors (arthritis, back/knee pain) and resolved the
 * chronic_fatigue/ME-CFS question. That validation process doesn't exist
 * yet, so this app stores what the user reports and stops there — nothing
 * downstream reads UserProfile.conditions. See onboarding-to-engine.ts's own
 * note on the same boundary.
 */
export const CONDITIONS = [
  'thyroid',
  'pcos',
  'iron_deficiency',
  'chronic_fatigue',
  'arthritis',
  'asthma',
  'diabetes',
  'back_knee_pain',
] as const;

export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  thyroid: 'Thyroid condition',
  pcos: 'PCOS',
  iron_deficiency: 'Iron deficiency / anemia',
  chronic_fatigue: 'Chronic fatigue',
  arthritis: 'Arthritis',
  asthma: 'Asthma',
  diabetes: 'Diabetes',
  back_knee_pain: 'Chronic back or knee pain',
};
