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
import { equipmentRequirementsFor } from './equipment-requirements';
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
export function bySelectionOrder(biasSimpleFirst: boolean, ownedEquipment?: readonly string[] | null) {
  // Only a real kit list ranks by kit — a full gym (null) or bodyweight
  // ([]) has nothing to prefer between.
  const preferKit = !!ownedEquipment && ownedEquipment.length > 0;
  // TRAINING VALUE (Vervein addition, not in the vault): numeric order
  // alone followed the library's authoring order, which put ex_116
  // Dumbbell Lateral Raise and ex_117 Bicep Curl ahead of ex_205 Pull-Up —
  // any setup without the barbell staples (ex_101–107) got two isolation
  // moves as its whole upper-body day. Training moves before mobility and
  // recovery; then, outside core, compound before the rest, moves with a
  // real movement pattern (squat, hinge, push, pull…) before pattern-less
  // odds and ends, and — for a home kit list — moves that use it before
  // ones that don't, so the kit someone owns shows up in their plan. Core
  // keeps library order after the type split: its "compound" entries are
  // the niche ones (loaded spinal flexion, barbell rollouts) and the
  // library already leads with the staples (plank, bird dog). One fixed key
  // per exercise, so the order is consistent whichever two are compared.
  // Still only an ordering: nothing is removed.
  const key = (ex: Exercise): number[] => {
    const core = ex.body_area === 'core';
    return [
      biasSimpleFirst && ex.complexity === 'moderate' ? 1 : 0,
      typeRank(ex),
      core || ex.is_compound === 'compound' ? 0 : 1,
      core || ex.movement_patterns.length > 0 ? 0 : 1,
      !preferKit || core || usesKit(ex) ? 0 : 1,
    ];
  };
  return (a: Exercise, b: Exercise): number => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return byNumericId(a, b);
  };
}

function typeRank(ex: Exercise): number {
  if (ex.type === 'strength' || ex.type === 'power') return 0;
  if (ex.type === 'cardio') return 1;
  if (ex.type === 'mobility') return 2;
  return 3;
}

// Already eligible by the time it's ranked, so any requirement it has is
// one the list covers.
function usesKit(ex: Exercise): boolean {
  const needs = equipmentRequirementsFor(ex.id);
  return !!needs && needs.length > 0;
}

class ExerciseLibraryModule {
  private exercises: Exercise[];
  // Vervein addition, not in the vault — getById/getByName were both a
  // linear .find() over the full ~1,449-exercise array, and both are called
  // repeatedly inside loops (training-state.ts's ledger/debt/recency folds
  // call getById once per exercise per trace; workout-log.ts's breakdown
  // readers call getByName once per logged exercise per entry). Safe to
  // index once, up front: the library is a frozen singleton built once per
  // process ("no runtime mutation" — this class's own constructor comment
  // below), so there's no invalidation case a Map could ever miss.
  private byId: Map<string, Exercise>;
  private byName: Map<string, Exercise>;

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
    this.byId = new Map(parsed.map((e) => [e.id, e]));
    // Duplicate names would silently shadow each other here (last write
    // wins) — same tradeoff getByName's own linear .find() already had
    // (first match wins there instead), not a new risk this introduces.
    this.byName = new Map(parsed.map((e) => [e.name, e]));
  }

  getById(id: string): Exercise | null {
    return this.byId.get(id) ?? null;
  }

  /** workout-log.ts records exercises by name, not id (see its own doc
   * comment) — this is that lookup path. Names are the library's real
   * human-facing identifier, same assumption check-in.tsx's exclusion
   * summary already relies on. */
  getByName(name: string): Exercise | null {
    return this.byName.get(name) ?? null;
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
