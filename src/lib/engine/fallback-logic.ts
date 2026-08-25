/**
 * M7 — Fallback Logic Module, ported from the adaptive-engine research
 * vault's src/modules/m7-fallback-logic.ts. Guarantees a session always
 * exists — replaces plan-preview.ts's old ad hoc `Math.max(2, Math.round(...))`
 * list-slicing with the real, governed mechanism: an unusably small filtered
 * pool or Energy Score 1 always resolves to the same two always-available
 * recovery exercises (ex_1023/ex_1083), never an invented minimum count.
 *
 * One deliberate divergence from the vault's verbatim source: the trigger
 * condition below is `<= 1`, not the vault's own `=== 0` — see the inline
 * comment on checkFallbackTrigger for why (a real, reachable crash the
 * vault's own spec doesn't handle).
 */

import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { Exercise, FallbackResult, FallbackTrigger } from '@/lib/engine/types';

export function checkFallbackTrigger(
  filteredListLength: number,
  energyScore: 1 | 2 | 3 | 4 | 5,
  stackingSignal: boolean
): FallbackResult | null {
  let trigger: FallbackTrigger | null = null;
  // DIVERGENCE FROM THE VAULT'S VERBATIM SOURCE, deliberate and disclosed
  // (matches this app's existing standard for handling a documented spec
  // gap — see symptom-tags.ts's own divergence note): the vault's real
  // condition is `=== 0`, but M10's assembleWorkout has its own hard
  // contract requiring at least 2 exercises. A pool narrowed to exactly 1
  // survivor by stacked constraints (symptom tags + movement restrictions +
  // equipment, all plausible together) is real and reachable — filterAndSubstitute's
  // gap-fill has no floor preventing it — and satisfies neither the vault's
  // `=== 0` check nor `energyScore === 1`, so it reached M10 uncaught and
  // crashed. Folded into the same 'empty-filter' trigger rather than a new
  // one: conceptually the same root cause (the constrained pool didn't
  // produce a usable multi-exercise session), and the existing copy for
  // that trigger already reads correctly for this case too.
  if (filteredListLength <= 1) trigger = 'empty-filter';
  else if (energyScore === 1) trigger = 'energy-1';
  else if (stackingSignal) trigger = 'p5-stacking-transition';

  if (!trigger) return null;

  const a = exerciseLibrary.getById('ex_1023') as Exercise;
  const b = exerciseLibrary.getById('ex_1083') as Exercise;
  return { exercises: [a, b], isRestDay: true, trigger };
}
