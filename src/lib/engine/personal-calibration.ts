/**
 * M15 — Personal Calibration Module, pure math ported verbatim from the
 * adaptive-engine research vault's src/modules/m15-personal-calibration.ts.
 * The one true learned, per-user state variable in this app. Hard clamp
 * [0.5, 1.4] cannot be bypassed by any caller.
 *
 * Storage is deliberately NOT here — the source module's `persistence`
 * dependency (M17) doesn't map onto this app's AsyncStorage-per-lib-file
 * convention, so the read/write wrapper lives in src/lib/calibration.ts
 * instead (mirrors how session-history.ts wraps AsyncStorage around its own
 * pure logic). This file stays what the rest of engine/ already is: pure,
 * synchronous, zero-runtime-dependency.
 */

import type { FeedbackResponse, UserCalibration } from '@/lib/engine/types';

// One "notch" of the 5-point feedback scale. The outer (much_too_*) values
// are two notches, not a separate invented magnitude — 2 * NOTCH === the
// single fixed STEP this module used before FeedbackResponse widened to 5
// values, so someone who always taps the extreme end sees the exact same
// max correction speed as before; the two new inner-adjacent-to-outer
// notches are what's actually new, giving a real "a little" vs "a lot"
// distinction that a flat +/-STEP couldn't express (Vervein addition, not a
// vault change — M15's own real math, the clamp and dampening below, is
// untouched).
const NOTCH = 0.04;
const DELTA_BY_FEEDBACK: Record<FeedbackResponse, number> = {
  much_too_easy: NOTCH * 2,
  too_easy: NOTCH,
  just_right: 0,
  too_hard: -NOTCH,
  much_too_hard: -NOTCH * 2,
};

export const DEFAULT_CALIBRATION: Omit<UserCalibration, 'userId'> = { multiplier: 1.0, sampleCount: 0 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeUpdatedCalibration(current: UserCalibration, feedback: FeedbackResponse): UserCalibration {
  const delta = DELTA_BY_FEEDBACK[feedback];
  const dampening = Math.min(1, 5 / (current.sampleCount + 1));
  return {
    userId: current.userId,
    multiplier: clamp(current.multiplier + delta * dampening, 0.5, 1.4),
    sampleCount: current.sampleCount + 1,
  };
}
