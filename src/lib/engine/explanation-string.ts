/**
 * M11 — Explanation String Module, ported verbatim from the adaptive-engine
 * research vault's src/modules/m11-explanation-string.ts. Base sentence +
 * tagLines + calibrationLine — replaces plan-preview.ts's old, self-authored
 * 5-line EXPLANATION_BY_ENERGY table.
 *
 * NOTE ON THE ONE GENUINELY OPEN GAP THIS MODULE MUST NOT PAPER OVER: no
 * template or honest generic fallback exists for a Condition Profile or
 * Movement Restrictions exclusion — activeTags here only ever carries real
 * symptom tags today (Condition Profile / Movement Restrictions are
 * collect-only, never wired into this array — see plan-preview.ts's own
 * scope note). The function asserts loudly rather than silently if an
 * unrecognized tag ever reaches it (see the throw below), per the source
 * project's "no engine-invented values" rule — the same fail-loud contract
 * constraint-resolution.ts (M5) already enforces one step earlier in the
 * pipeline, so this is a defensive second check, not the only one.
 *
 * BUG-IN-WAITING, FIXED: TAG_LINES used to be typed Record<string, string>
 * — a plain object literal that happened to cover the same 10 tags
 * SYMPTOM_OVERRIDE_TABLE does, but with nothing enforcing that going
 * forward. A future symptom tag could be added to symptom-tags.ts and
 * SYMPTOM_OVERRIDE_TABLE (both correctly typed as total maps over
 * SymptomTag) while this file's own line was forgotten, compiling clean and
 * silently shipping a workout with real constraint effects but no
 * corresponding "why" text. Retyped as Record<SymptomTag, string> so the
 * compiler now forces completeness here too.
 *
 * DEAD PARAMETER REMOVED (found in a later full-app audit): buildExplanation
 * used to also take a `scaledResult` argument (the assembled exercise list)
 * that was never read anywhere in this function's body — plan-preview.ts's
 * own only call site computed and passed a real value for it with no
 * effect on the output. Removed rather than left as an unused capability,
 * same reasoning as sparkline.tsx's own `muted` prop removal.
 */

import type { UserCalibration } from '@/lib/engine/types';
import type { SymptomTag } from '@/lib/symptom-tags';

/** The energy-5 template's closing question, exported so a session where
 * the finisher was accepted can drop it instead of asking and confirming in
 * the same breath (see plan-preview.ts's withFinisherNote). */
export const FINISHER_QUESTION = 'Want an optional finisher set added to each exercise?';

const BASE_TEMPLATES: Record<1 | 2 | 3 | 4 | 5, (ctx: { totalDuration: number; pct: number }) => string> = {
  // The real total of the recovery session, not a fixed "10 minutes": the
  // two fallback exercises add up to 9, and the line sat right above a
  // "9 min" summary.
  1: (ctx) =>
    `You're running on empty today — that's real data, not failure. Here's ${
      ctx.totalDuration > 0 ? `${ctx.totalDuration} minutes` : 'a few minutes'
    } of gentle movement that won't deplete you further.`,
  2: (ctx) => `Energy's low → session cut to ${ctx.totalDuration} min, sets reduced to ${ctx.pct}% of baseline. Moving gently beats not moving.`,
  3: () => "Energy's steady today. Sticking with your baseline plan.",
  4: () => 'Feeling good — full plan, no changes needed.',
  5: () => `Today's plan is ready, full baseline — no automatic increase. ${FINISHER_QUESTION}`,
};

/** Exported so callers can show which real symptom-tag override fired
 * outside the joined explanation sentence too (e.g. check-in.tsx's
 * post-commit reasoning panel) — same source of truth, not a duplicate. */
export const TAG_LINES: Record<SymptomTag, string> = {
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
  totalDuration: number,
  overallSetsPct: number
): { explanation: string; explanationMapping: { reduction: string; template: string | null }[] } {
  const parts: string[] = [BASE_TEMPLATES[energyScore]({ totalDuration, pct: overallSetsPct })];
  const explanationMapping: { reduction: string; template: string | null }[] = [
    { reduction: `energy=${energyScore}`, template: BASE_TEMPLATES[energyScore]({ totalDuration, pct: overallSetsPct }) },
  ];

  for (const tag of activeTags) {
    // Cast, not a type-level guarantee — activeTags arrives as plain
    // string[] (same reasoning as constraint-resolution.ts's identical
    // cast). The throw right below is the real safety net: by the time a
    // tag reaches here it should have already passed M5's own identical
    // guard against the same SYMPTOM_OVERRIDE_TABLE key set, so this should
    // never actually fire — but "should never fire" is exactly the case a
    // silent fallback would hide instead of surface.
    const line = TAG_LINES[tag as SymptomTag];
    if (!line) {
      throw new Error(`M11: unrecognized symptom tag "${tag}" reached the explanation builder — Gate 1 (M5) should have already rejected this upstream.`);
    }
    parts.push(line);
    explanationMapping.push({ reduction: `symptom:${tag}`, template: line });
  }

  const calLine = calibrationLine(calibration);
  if (calLine) {
    parts.push(calLine);
    explanationMapping.push({ reduction: 'calibration', template: calLine });
  }

  return { explanation: parts.join(' '), explanationMapping };
}
