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

const STEP = 0.08;

export const DEFAULT_CALIBRATION: Omit<UserCalibration, 'userId'> = { multiplier: 1.0, sampleCount: 0 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeUpdatedCalibration(current: UserCalibration, feedback: FeedbackResponse): UserCalibration {
  const delta = feedback === 'too_easy' ? STEP : feedback === 'too_hard' ? -STEP : 0;
  const dampening = Math.min(1, 5 / (current.sampleCount + 1));
  return {
    userId: current.userId,
    multiplier: clamp(current.multiplier + delta * dampening, 0.5, 1.4),
    sampleCount: current.sampleCount + 1,
  };
}
