/**
 * M11 — Explanation String Module, ported verbatim from the adaptive-engine
 * research vault's src/modules/m11-explanation-string.ts. Base sentence +
 * tagLines + calibrationLine — replaces plan-preview.ts's old, self-authored
 * 5-line EXPLANATION_BY_ENERGY table.
 *
 * NOTE ON THE ONE GENUINELY OPEN GAP THIS MODULE MUST NOT PAPER OVER: no
 * template or honest generic fallback exists for a Condition Profile or
 * Movement Restrictions exclusion. Moot in this app today — activeTags is
 * always [] since no symptom/condition intake exists yet — but the function
 * still asserts loudly rather than silently if that ever changes, per the
 * source project's "no engine-invented values" rule.
 */

import type { Exercise, ScaledExerciseList, UserCalibration } from '@/lib/engine/types';

const BASE_TEMPLATES: Record<1 | 2 | 3 | 4 | 5, (ctx: { totalDuration: number; pct: number }) => string> = {
  1: () => "You're running on empty today — that's real data, not failure. Here's 10 minutes of gentle movement that won't deplete you further.",
  2: (ctx) => `Energy's low → session cut to ${ctx.totalDuration} min, sets reduced to ${ctx.pct}% of baseline. Moving gently beats not moving.`,
  3: () => "Energy's steady today. Sticking with your baseline plan.",
  4: () => 'Feeling good — full plan, no changes needed.',
  5: () => 'Today\'s plan is ready, full baseline — no automatic increase. Want an optional finisher set added to each exercise?',
};

const TAG_LINES: Record<string, string> = {
  period: 'Swapped high-impact moves for low-impact — period days deserve gentler loading.',
  brain_fog: 'Brain fog noted → session shortened and kept to simpler movements.',
  sore_legs: 'Legs flagged as sore → substituted lower-body work with upper body and core.',
  sore_upper: 'Upper body flagged as sore → substituted upper-body work with lower body and core.',
  stressed: 'Stress overrides intensity today — lower load, added a recovery element.',
  nausea: 'Nausea flagged → switched to gentle mobility only. Rest is valid.',
  poor_sleep: 'Poor sleep noted → intensity capped and today\'s session trimmed slightly. Recovery matters too.',
  joint_pain: 'Joint pain flagged → switched to lower-impact movements to protect the joint.',
  dizziness: 'Dizziness noted → kept to lower-impact, more stable movements today.',
  heat_intolerance: 'Heat sensitivity noted → intensity capped to keep today\'s session manageable.',
};

function calibrationLine(calibration: UserCalibration): string | null {
  if (calibration.sampleCount === 0 || calibration.multiplier === 1.0) return null;
  return calibration.multiplier > 1.0
    ? "Your recent feedback said past sessions felt manageable → today's nudged up slightly, and will keep adjusting as more feedback comes in."
    : "Your recent feedback said past sessions felt tough → today's eased back slightly, and will keep adjusting as more feedback comes in.";
}

export function buildExplanation(
  energyScore: 1 | 2 | 3 | 4 | 5,
  activeTags: string[],
  calibration: UserCalibration,
  scaledResult: ScaledExerciseList | [Exercise, Exercise],
  totalDuration: number,
  overallSetsPct: number
): { explanation: string; explanationMapping: { reduction: string; template: string | null }[] } {
  const parts: string[] = [BASE_TEMPLATES[energyScore]({ totalDuration, pct: overallSetsPct })];
  const explanationMapping: { reduction: string; template: string | null }[] = [
    { reduction: `energy=${energyScore}`, template: BASE_TEMPLATES[energyScore]({ totalDuration, pct: overallSetsPct }) },
  ];

  for (const tag of activeTags) {
    const line = TAG_LINES[tag];
    if (line) {
      parts.push(line);
      explanationMapping.push({ reduction: `symptom:${tag}`, template: line });
    } else {
      explanationMapping.push({ reduction: `symptom:${tag}`, template: null });
    }
  }

  const calLine = calibrationLine(calibration);
  if (calLine) {
    parts.push(calLine);
    explanationMapping.push({ reduction: 'calibration', template: calLine });
  }

  return { explanation: parts.join(' '), explanationMapping };
}
