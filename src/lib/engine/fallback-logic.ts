/**
 * M7 — Fallback Logic Module, ported verbatim from the adaptive-engine
 * research vault's src/modules/m7-fallback-logic.ts. Guarantees a session
 * always exists — replaces plan-preview.ts's old ad hoc
 * `Math.max(2, Math.round(...))` list-slicing with the real, governed
 * mechanism: an empty filtered pool or Energy Score 1 always resolves to the
 * same two always-available recovery exercises (ex_1023/ex_1083), never an
 * invented minimum count.
 */

import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { Exercise, FallbackResult, FallbackTrigger } from '@/lib/engine/types';

export function checkFallbackTrigger(
  filteredListLength: number,
  energyScore: 1 | 2 | 3 | 4 | 5,
  stackingSignal: boolean
): FallbackResult | null {
  let trigger: FallbackTrigger | null = null;
  if (filteredListLength === 0) trigger = 'empty-filter';
  else if (energyScore === 1) trigger = 'energy-1';
  else if (stackingSignal) trigger = 'p5-stacking-transition';

  if (!trigger) return null;

  const a = exerciseLibrary.getById('ex_1023') as Exercise;
  const b = exerciseLibrary.getById('ex_1083') as Exercise;
  return { exercises: [a, b], isRestDay: true, trigger };
}
