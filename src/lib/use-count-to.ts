import { useEffect, useRef, useState } from 'react';

/** How long a count takes — the same ~0.4s the check-in's live session size
 * and the vervein.app demo use, so every counting number moves alike. */
export const COUNT_DURATION_MS = 420;

/**
 * Eases a displayed integer from its last value to `target` (ease-out
 * cubic). Restarts from wherever it is if the target moves mid-count.
 *
 * `instant` shows the target straight away and resyncs to it — pass true
 * for Reduce Motion, and while a screen is still loading its first real
 * value, so a number arriving from storage doesn't count up from a
 * placeholder on every launch; only real changes after that animate.
 *
 * `from` starts the very first count somewhere other than the target (a
 * screen that wants to show one value turning into another on arrival);
 * `delayMs` holds that count until something else has landed. Both only
 * matter while a count is pending.
 */
export function useCountTo(target: number, instant: boolean, from?: number, delayMs = 0): number {
  const [shown, setShown] = useState(from ?? target);
  const current = useRef(from ?? target);
  useEffect(() => {
    if (instant) {
      current.current = target;
      return;
    }
    const start = current.current;
    if (start === target) return;
    let frame = 0;
    let startedAt: number | null = null;
    const step = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / COUNT_DURATION_MS, 1);
      const next = Math.round(start + (target - start) * (1 - Math.pow(1 - progress, 3)));
      current.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    const timer = delayMs > 0 ? setTimeout(() => (frame = requestAnimationFrame(step)), delayMs) : null;
    if (timer === null) frame = requestAnimationFrame(step);
    return () => {
      if (timer !== null) clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, instant, delayMs]);
  return instant ? target : shown;
}
