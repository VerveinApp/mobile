/**
 * The ten symptom tags engine/reference/symptom-override-table.ts already
 * defines override behavior for — SYMPTOM_OVERRIDE_TABLE has been sitting
 * fully wired but unreachable since M5/M8 were ported, because nothing ever
 * collected a real tag to feed them.
 *
 * Every tag here can be picked fresh at check-in (energy 1-2, per the
 * vault's two-step disclosure), same as the energy score itself — most of
 * these (soreness, stress, a bad night) genuinely vary day to day. The four
 * in STANDING_SYMPTOM_TAGS below can also be set once in Settings and then
 * apply every day, at every energy level.
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

/**
 * The vault's "standing" tags (Symptom Tags.md: set once, active every day
 * until changed) — the patterns someone lives with rather than has today.
 * The app used to skip these entirely because the vault's notes disagreed
 * about which tags were standing; the vault itself settled that (2026-07-16:
 * joint_pain, dizziness, brain_fog, heat_intolerance, poor_sleep). The gap
 * that left: someone with bad knees who feels "Good" had no way to say so —
 * the daily picker only appears at energy 1-2 — and could be handed jumps.
 *
 * poor_sleep is deliberately NOT standing here, unlike the vault: this app
 * already reads real sleep from Apple Health into the daily readiness
 * modifier, so a standing poor_sleep would cut every session twice, and a
 * bad night is exactly what the daily picker is for.
 *
 * Every override these map to only ever tightens (lower impact, a lower
 * intensity ceiling, a shorter session) — never adds load — so a wrong or
 * stale answer can make a plan gentler than it needed to be, never riskier.
 */
export const STANDING_SYMPTOM_TAGS = ['joint_pain', 'dizziness', 'heat_intolerance', 'brain_fog'] as const satisfies readonly SymptomTag[];

export type StandingSymptomTag = (typeof STANDING_SYMPTOM_TAGS)[number];

export function isStandingSymptomTag(tag: string): tag is StandingSymptomTag {
  return (STANDING_SYMPTOM_TAGS as readonly string[]).includes(tag);
}

/** What each one actually changes — straight from SYMPTOM_OVERRIDE_TABLE's
 * rows, so the Settings sheet never promises more than the engine does. */
export const STANDING_SYMPTOM_EFFECTS: Record<StandingSymptomTag, string> = {
  joint_pain: 'Low-impact moves only',
  dizziness: 'Low-impact moves only',
  heat_intolerance: 'Intensity kept moderate',
  brain_fog: 'Sessions a little shorter',
};
