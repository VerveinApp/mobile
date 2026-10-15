import type { TimerInterval } from '@/lib/exercise-timer';

/** What one tap of the rest timer's −15s / +15s moves it by. */
export const REST_ADJUST_STEP_SECONDS = 15;
/** A shortened rest still leaves this long — enough to see it end and pick
 * the weight back up, instead of jumping straight to "Start set". */
export const MIN_REST_SECONDS_LEFT = 5;
/** How far past the plan's own rest the +15s button can stretch it. */
export const MAX_REST_EXTENSION_SECONDS = 5 * 60;

/**
 * A rest after one −15s / +15s tap: the new seconds left and the new total
 * the countdown ring drains against. Shortening never leaves under
 * MIN_REST_SECONDS_LEFT (a tap that can't take the full 15 takes what it can,
 * and one already under it changes nothing); lengthening stops at
 * MAX_REST_EXTENSION_SECONDS past the planned rest.
 */
export function adjustRest({
  secondsLeft,
  total,
  plannedSeconds,
  delta,
}: {
  secondsLeft: number;
  total: number;
  plannedSeconds: number;
  delta: number;
}): { secondsLeft: number; total: number } {
  const floor = Math.min(secondsLeft, MIN_REST_SECONDS_LEFT);
  let next = Math.max(floor, secondsLeft + delta);
  const maxTotal = plannedSeconds + MAX_REST_EXTENSION_SECONDS;
  let nextTotal = total + (next - secondsLeft);
  if (nextTotal > maxTotal) {
    next -= nextTotal - maxTotal;
    nextTotal = maxTotal;
  }
  if (delta > 0 && next < secondsLeft) return { secondsLeft, total };
  return { secondsLeft: next, total: nextTotal };
}

/** Sets of this exercise already finished, for the dots under the clock:
 * a rest follows the set it's numbered with, and a work interval counts
 * once its countdown reaches 0. */
export function setsDoneFor(interval: Pick<TimerInterval, 'kind' | 'setNumber'>, secondsLeft: number): number {
  if (interval.kind === 'rest') return interval.setNumber;
  return secondsLeft === 0 ? interval.setNumber : interval.setNumber - 1;
}
