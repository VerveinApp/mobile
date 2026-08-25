// M18 — Exercise Library Module.
// Ported from the adaptive-engine research vault's src/modules/m18-exercise-library.ts.
// Purpose: serve the frozen Knowledge Graph as canonical read-only reference data.
//
// PORT NOTE: the only change from the vault source is how the library loads.
// The original used Node's fs.readFileSync against a path on disk — not
// available in React Native. This version statically imports the identical
// JSON fixture (data/exercise-library.json, copied byte-for-byte from the
// vault's fixtures/exercise-library.json — the real 1,449-exercise compiled
// library, not the smaller demo slice an earlier draft of that file's own
// comment described) as a bundled asset instead. Every other line —
// validation, freezing, the M7 fallback-pair boot check — is unchanged.

import exerciseData from './data/exercise-library.json';
import type { Equipment, Exercise, Impact, Intensity } from './types';

const CANONICAL_INTENSITY: Intensity[] = ['low', 'medium', 'high'];
const CANONICAL_IMPACT: Impact[] = ['low', 'medium', 'high'];
const CANONICAL_EQUIPMENT: Equipment[] = ['none', 'minimal', 'full_gym'];

export const INTENSITY_RANK: Record<Intensity, number> = { low: 0, medium: 1, high: 2 };
export const IMPACT_RANK: Record<Impact, number> = { low: 0, medium: 1, high: 2 };
export const EQUIPMENT_RANK: Record<Equipment, number> = { none: 0, minimal: 1, full_gym: 2 };

/** Deterministic numeric library order (ex_101 < ex_102 < … < ex_1500) —
 * the vault's own selection-order rule (Baseline Plan.md: "selection is
 * deterministic: numeric library order"). Shared by baseline-plan.ts and
 * exercise-filtering.ts so both use one definition. */
export function byNumericId(a: Exercise, b: Exercise): number {
  return parseInt(a.id.replace('ex_', ''), 10) - parseInt(b.id.replace('ex_', ''), 10);
}

/**
 * Not a vault module — a disclosed Vervein addition (see baseline-plan.ts
 * and exercise-filtering.ts headers for the full rationale). A soft
 * preference ordering, never a filter: `moderate` exercises are never
 * removed, only sorted behind `simple` ones when `biasSimpleFirst` is true,
 * so a `moderate` exercise can still fill a slot when it's the only legal
 * option left — Decision Invariant #1 ("the user always gets a workout")
 * never bends for this. Numeric ID stays the tiebreak either way, so
 * selection remains fully deterministic, just reordered.
 */
export function bySelectionOrder(biasSimpleFirst: boolean) {
  return (a: Exercise, b: Exercise): number => {
    if (biasSimpleFirst) {
      const penaltyA = a.complexity === 'moderate' ? 1 : 0;
      const penaltyB = b.complexity === 'moderate' ? 1 : 0;
      if (penaltyA !== penaltyB) return penaltyA - penaltyB;
    }
    return byNumericId(a, b);
  };
}

class ExerciseLibraryModule {
  private exercises: Exercise[];

  constructor() {
    const parsed = exerciseData as unknown as Exercise[];
    // Validation boundary (AU-16's standing rule, per the source module):
    // reject any non-canonical value before it can ever reach a
    // filter/rank comparison.
    for (const ex of parsed) {
      if (ex.intensity !== null && !CANONICAL_INTENSITY.includes(ex.intensity)) {
        throw new Error(`M18: non-canonical intensity "${ex.intensity}" on ${ex.id}`);
      }
      if (!CANONICAL_IMPACT.includes(ex.impact)) {
        throw new Error(`M18: non-canonical impact "${ex.impact}" on ${ex.id}`);
      }
      if (!CANONICAL_EQUIPMENT.includes(ex.equipment)) {
        throw new Error(`M18: non-canonical equipment "${ex.equipment}" on ${ex.id}`);
      }
    }
    // L5 fix: frozen content is structurally frozen — no module can mutate a
    // shared library record mid-run.
    for (const ex of parsed) {
      Object.freeze(ex.movement_patterns);
      Object.freeze(ex.contraindications);
      Object.freeze(ex);
    }
    this.exercises = parsed;
  }

  getById(id: string): Exercise | null {
    return this.exercises.find((e) => e.id === id) ?? null;
  }

  /** workout-log.ts records exercises by name, not id (see its own doc
   * comment) — this is that lookup path. Names are the library's real
   * human-facing identifier, same assumption check-in.tsx's exclusion
   * summary already relies on. */
  getByName(name: string): Exercise | null {
    return this.exercises.find((e) => e.name === name) ?? null;
  }

  query(filterCriteria: Partial<Exercise>): Exercise[] {
    // Array-valued fields (movement_patterns, contraindications) match by
    // subset: every requested element must be present. Scalars match by
    // equality. (L4 fix — strict === could never match an array criterion.)
    return this.exercises.filter((e) =>
      Object.entries(filterCriteria).every(([k, v]) => {
        const actual = (e as Record<string, unknown>)[k];
        if (Array.isArray(v) && Array.isArray(actual)) {
          return v.every((item) => actual.includes(item));
        }
        return actual === v;
      })
    );
  }

  all(): Exercise[] {
    return [...this.exercises];
  }
}

// Singleton — one frozen library per process, per M18's own stated design (no runtime mutation).
export const exerciseLibrary = new ExerciseLibraryModule();

// M7's hard dependency — checked eagerly so a broken fallback pair fails at boot,
// not silently at the one moment the product cannot afford it to fail.
for (const id of ['ex_1023', 'ex_1083']) {
  if (!exerciseLibrary.getById(id)) {
    throw new Error(`M18: Fallback Logic's hardcoded dependency "${id}" does not resolve. This is the exact F-1 regression the source project already fixed once.`);
  }
}
