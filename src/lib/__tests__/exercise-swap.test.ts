import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { EffectiveConstraintSet } from '@/lib/engine/types';
import { buildSwapReplacement, getSwapCandidates } from '@/lib/exercise-swap';
import type { PlanExercise } from '@/lib/plan-preview';
import { makeConstraints, makeExercise } from '@/lib/engine/testing/test-fixtures';

const PERMISSIVE_CONSTRAINTS: EffectiveConstraintSet = makeConstraints();

function planExerciseFromLibrary(id: string): PlanExercise {
  const ex = exerciseLibrary.getById(id)!;
  return {
    name: ex.name,
    sets: ex.base_sets,
    reps: ex.base_reps,
    durationMin: ex.base_duration_min,
    bodyArea: ex.body_area,
    repStructure: ex.rep_structure,
    intensity: ex.intensity,
    isCompound: ex.is_compound,
    id: ex.id,
  };
}

// Real, integration-style — getSwapCandidates is inherently coupled to the
// real 1,449-exercise library singleton (a module-level global, not
// dependency-injected), so a mocked-library unit test would exercise a
// fiction, not the code path production actually runs.
describe('getSwapCandidates (against the real exercise library)', () => {
  const anchor = exerciseLibrary.all().find((ex) => ex.active && ex.movement_patterns.length > 0)!;
  const current = planExerciseFromLibrary(anchor.id);

  it('every candidate shares the anchor\'s exact body area', () => {
    const candidates = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, []);
    for (const c of candidates) expect(c.body_area).toBe(anchor.body_area);
  });

  it('every candidate shares at least one movement pattern with the anchor', () => {
    const candidates = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, []);
    for (const c of candidates) {
      expect(c.movement_patterns.some((p) => anchor.movement_patterns.includes(p))).toBe(true);
    }
  });

  // getSwapCandidates does NOT self-exclude the current exercise — check-
  // in.tsx's own call site relies on excludeIds already including it (it
  // passes sessionExercises.map(e => e.id), and the exercise being swapped
  // is itself one of sessionExercises). This test documents that real
  // contract rather than assuming self-exclusion the function doesn't do.
  it('excludes the anchor exercise itself once its id is in excludeIds, as every real caller provides', () => {
    const candidates = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, [anchor.id]);
    expect(candidates.some((c) => c.id === anchor.id)).toBe(false);
  });

  it('excludes ids passed via excludeIds (today\'s other session exercises)', () => {
    const all = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, []);
    if (all.length === 0) return;
    const filtered = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, [all[0].id]);
    expect(filtered.some((c) => c.id === all[0].id)).toBe(false);
  });

  it('a maximally restrictive constraint set never yields MORE candidates than a permissive one', () => {
    const restrictive: EffectiveConstraintSet = {
      ...PERMISSIVE_CONSTRAINTS,
      equipmentCeiling: 'none',
      intensityCeiling: 'low',
      impactCeiling: 'low',
    };
    const permissiveCount = getSwapCandidates(current, PERMISSIVE_CONSTRAINTS, []).length;
    const restrictiveCount = getSwapCandidates(current, restrictive, []).length;
    expect(restrictiveCount).toBeLessThanOrEqual(permissiveCount);
  });

  it('returns an empty list for an id that does not exist in the library', () => {
    const bogus: PlanExercise = { ...current, id: 'this-id-does-not-exist-in-the-library' };
    expect(getSwapCandidates(bogus, PERMISSIVE_CONSTRAINTS, [])).toEqual([]);
  });
});

describe('buildSwapReplacement', () => {
  it('carries the candidate\'s base_reps through unscaled, matching scaleVolume\'s own adapted_reps behavior', () => {
    const candidate = makeExercise({ base_reps: 12 });
    const original: PlanExercise = {
      name: 'Original',
      sets: 3,
      reps: 10,
      durationMin: 5,
      bodyArea: 'upper',
      repStructure: 'discrete',
      intensity: 'medium',
      isCompound: 'accessory',
      id: 'orig',
    };
    const originalFull = makeExercise({ id: 'orig', base_sets: 4, base_duration_min: 10 });
    expect(buildSwapReplacement(candidate, original, originalFull).reps).toBe(12);
  });

  it('scales sets by the exact ratio the original exercise was already adapted by', () => {
    const candidate = makeExercise({ base_sets: 4 });
    const original: PlanExercise = {
      name: 'Original',
      sets: 2, // adapted from a base of 4 -> ratio 0.5
      reps: 10,
      durationMin: null,
      bodyArea: 'upper',
      repStructure: 'discrete',
      intensity: 'medium',
      isCompound: 'accessory',
      id: 'orig',
    };
    const originalFull = makeExercise({ id: 'orig', base_sets: 4, base_duration_min: null });
    expect(buildSwapReplacement(candidate, original, originalFull).sets).toBe(2);
  });

  it('never produces fewer than 1 set, even at a steep reduction ratio', () => {
    const candidate = makeExercise({ base_sets: 1 });
    const original: PlanExercise = {
      name: 'Original',
      sets: 1, // adapted from a base of 10 -> ratio 0.1
      reps: 10,
      durationMin: null,
      bodyArea: 'upper',
      repStructure: 'discrete',
      intensity: 'medium',
      isCompound: 'accessory',
      id: 'orig',
    };
    const originalFull = makeExercise({ id: 'orig', base_sets: 10, base_duration_min: null });
    expect(buildSwapReplacement(candidate, original, originalFull).sets).toBeGreaterThanOrEqual(1);
  });

  it('rounds duration to the nearest 5 minutes, matching scaleVolume\'s own rounding formula', () => {
    const candidate = makeExercise({ base_duration_min: 10 });
    const original: PlanExercise = {
      name: 'Original',
      sets: null,
      reps: null,
      durationMin: 6, // adapted from a base of 8 -> ratio 0.75
      bodyArea: 'upper',
      repStructure: 'isometric_hold',
      intensity: 'medium',
      isCompound: null,
      id: 'orig',
    };
    const originalFull = makeExercise({ id: 'orig', base_sets: null, base_duration_min: 8 });
    // 10 * 0.75 = 7.5 -> round to nearest 5 -> 10
    expect(buildSwapReplacement(candidate, original, originalFull).durationMin).toBe(10);
  });

  it('falls back to a 1x ratio when the original had no real sets/duration to compare against', () => {
    const candidate = makeExercise({ base_sets: 3 });
    const original: PlanExercise = {
      name: 'Original',
      sets: null,
      reps: null,
      durationMin: null,
      bodyArea: 'upper',
      repStructure: 'discrete',
      intensity: 'medium',
      isCompound: null,
      id: 'orig',
    };
    const originalFull = makeExercise({ id: 'orig', base_sets: null, base_duration_min: null });
    expect(buildSwapReplacement(candidate, original, originalFull).sets).toBe(3);
  });
});
