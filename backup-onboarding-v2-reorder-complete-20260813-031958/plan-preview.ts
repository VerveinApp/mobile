/**
 * Placeholder stand-in for the real adaptive decision engine, used only to
 * power the First Look demo screen. Deliberately isolated in its own module
 * with a narrow, engine-shaped input/output contract so swapping in real
 * engine calls later is a one-file change, not a screen rewrite.
 *
 * Not scripted per-copy — this is a real (if simplified) computation over
 * the user's actual onboarding answers, so the two energy levels genuinely
 * produce different numbers, not pre-written marketing text.
 */

export type EnergyLevel = 2 | 4;

export type PlanPreviewInput = {
  experience?: string;
  duration?: string;
  commitmentLevel?: string;
};

export type PlanPreviewResult = {
  exerciseCount: number;
  durationMin: number;
  explanation: string;
};

const BASE_EXERCISES_BY_EXPERIENCE: Record<string, number> = {
  'just-starting': 4,
  'trained-before': 5,
  'train-regularly': 6,
  'years-experience': 7,
};

const BASE_DURATION_MIN_BY_BUCKET: Record<string, number> = {
  'under-30': 25,
  '30-45': 38,
  '45-60': 52,
  '60-plus': 65,
};

export function computePlanPreview(input: PlanPreviewInput, energy: EnergyLevel): PlanPreviewResult {
  const baseExercises = BASE_EXERCISES_BY_EXPERIENCE[input.experience ?? ''] ?? 5;
  const baseDuration = BASE_DURATION_MIN_BY_BUCKET[input.duration ?? ''] ?? 38;

  // A low-energy day scales the same baseline session down rather than
  // swapping in a different plan — the point being demonstrated is
  // adaptation, not a second, unrelated workout.
  const factor = energy === 2 ? 0.55 : 1;
  const exerciseCount = Math.max(2, Math.round(baseExercises * factor));
  const durationMin = Math.max(10, Math.round(baseDuration * factor));

  const explanation =
    energy === 2
      ? `Low energy today — trimmed to the essentials: ${exerciseCount} exercises, about ${durationMin} min.`
      : `Feeling good — here's your full session: ${exerciseCount} exercises, about ${durationMin} min.`;

  return { exerciseCount, durationMin, explanation };
}
