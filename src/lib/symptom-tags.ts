/**
 * The ten symptom tags engine/reference/symptom-override-table.ts already
 * defines override behavior for — SYMPTOM_OVERRIDE_TABLE has been sitting
 * fully wired but unreachable since M5/M8 were ported, because nothing ever
 * collected a real tag to feed them.
 *
 * SCOPE DECISION — the vault's own onboarding splits these into "standing"
 * (asked once, applies daily) and "acute" (asked fresh at check-in), but
 * ARCHITECTURE-REVIEW.md's own structural pass on that vault found the split
 * self-contradictory (poor_sleep and brain_fog are double-classified —
 * defined as standing in two notes, but listed in the daily check-in mockup
 * in a third). Rather than import an unresolved spec bug, every tag here is
 * asked fresh at check-in, same as the energy score itself — simpler, and
 * arguably more honest anyway, since most of these (poor sleep, soreness,
 * stress) genuinely do vary day to day rather than being a fixed trait worth
 * setting once and forgetting.
 */
export const SYMPTOM_TAGS = [
  'period',
  'brain_fog',
  'sore_legs',
  'sore_upper',
  'stressed',
  'nausea',
  'poor_sleep',
  'joint_pain',
  'dizziness',
  'heat_intolerance',
] as const;

export type SymptomTag = (typeof SYMPTOM_TAGS)[number];

export const SYMPTOM_TAG_LABELS: Record<SymptomTag, string> = {
  period: 'Period',
  brain_fog: 'Brain fog',
  sore_legs: 'Sore legs',
  sore_upper: 'Sore upper body',
  stressed: 'Stressed',
  nausea: 'Nausea',
  poor_sleep: 'Poor sleep',
  joint_pain: 'Joint pain',
  dizziness: 'Dizziness',
  heat_intolerance: 'Heat sensitivity',
};
