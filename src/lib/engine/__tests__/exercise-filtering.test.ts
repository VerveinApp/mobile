import { exerciseLibrary } from '@/lib/engine/exercise-library';
import { filterAndSubstitute, passesConstraints } from '@/lib/engine/exercise-filtering';
import type { BaselinePlan } from '@/lib/engine/types';
import { makeConstraints, makeExercise } from '@/lib/engine/testing/test-fixtures';

const PERMISSIVE = makeConstraints();

function makeBaselinePlan(exerciseIds: string[]): BaselinePlan {
  return {
    userId: 'test-user',
    sessionDays: [],
    exerciseIds,
    targetIntensity: 'medium',
    equipment: 'full_gym',
    focusAreas: ['full'],
  };
}

describe('passesConstraints', () => {
  it('passes an exercise with no dimension exceeding the ceiling', () => {
    const ex = makeExercise({ intensity: 'medium', impact: 'low', equipment: 'minimal' });
    expect(passesConstraints(ex, PERMISSIVE)).toBe(true);
  });

  it('fails when intensity exceeds the ceiling', () => {
    const ex = makeExercise({ intensity: 'high' });
    expect(passesConstraints(ex, makeConstraints({ intensityCeiling: 'low' }))).toBe(false);
  });

  it('a null intensity always passes the intensity check (no claim to rank)', () => {
    const ex = makeExercise({ intensity: null });
    expect(passesConstraints(ex, makeConstraints({ intensityCeiling: 'low' }))).toBe(true);
  });

  it('fails when equipment exceeds the ceiling', () => {
    const ex = makeExercise({ equipment: 'full_gym' });
    expect(passesConstraints(ex, makeConstraints({ equipmentCeiling: 'none' }))).toBe(false);
  });

  it('fails when the exercise\'s own body area is excluded', () => {
    const ex = makeExercise({ body_area: 'lower' });
    expect(passesConstraints(ex, makeConstraints({ excludeBodyAreas: ['lower'] }))).toBe(false);
  });

  it('the full-body rule: a "full" body-area exercise is excluded by ANY body-area exclusion', () => {
    const ex = makeExercise({ body_area: 'full' });
    expect(passesConstraints(ex, makeConstraints({ excludeBodyAreas: ['core'] }))).toBe(false);
  });

  it('fails when a movement pattern is excluded', () => {
    const ex = makeExercise({ movement_patterns: ['squat', 'hinge'] });
    expect(passesConstraints(ex, makeConstraints({ excludeMovementPatterns: ['squat'] }))).toBe(false);
  });

  it('fails when a contraindication matches an excluded condition', () => {
    const ex = makeExercise({ contraindications: ['knee-injury'] });
    expect(passesConstraints(ex, makeConstraints({ excludeContraindicatedFor: ['knee-injury'] }))).toBe(false);
  });
});

// Integration-style, against the real 1,449-exercise library — same
// rationale as exercise-swap.test.ts: filterAndSubstitute is inherently
// coupled to the real exerciseLibrary singleton, so mocking it would test a
// fiction.
describe('filterAndSubstitute (against the real exercise library)', () => {
  it('keeps every baseline exercise under fully permissive constraints', () => {
    const anchors = exerciseLibrary
      .all()
      .filter((e) => e.active)
      .slice(0, 5)
      .map((e) => e.id);
    const result = filterAndSubstitute(makeBaselinePlan(anchors), PERMISSIVE);
    expect(result.filtered.map((e) => e.id).sort()).toEqual([...anchors].sort());
    expect(result.gate1Exclusions).toHaveLength(0);
    expect(result.gapFillShortfall).toBe(0);
  });

  it('excludes an inactive baseline exercise and traces it as "inactive"', () => {
    const inactive = exerciseLibrary.all().find((e) => !e.active);
    if (!inactive) return; // no inactive exercise in the current library — nothing to test
    const anchors = exerciseLibrary
      .all()
      .filter((e) => e.active)
      .slice(0, 2)
      .map((e) => e.id);
    const result = filterAndSubstitute(makeBaselinePlan([inactive.id, ...anchors]), PERMISSIVE);
    expect(result.gate1Exclusions).toContainEqual({ exerciseId: inactive.id, excludedBy: 'inactive' });
    expect(result.filtered.some((e) => e.id === inactive.id)).toBe(false);
  });

  it('a fully restrictive constraint set (equipment: none, intensity: low, impact: low) removes anything that needs more, and gap-fills or reports a real shortfall — never a fabricated survivor', () => {
    const anchors = exerciseLibrary
      .all()
      .filter((e) => e.active && (e.equipment !== 'none' || e.intensity === 'high' || e.impact === 'high'))
      .slice(0, 5)
      .map((e) => e.id);
    if (anchors.length === 0) return;
    const restrictive = makeConstraints({ equipmentCeiling: 'none', intensityCeiling: 'low', impactCeiling: 'low' });
    const result = filterAndSubstitute(makeBaselinePlan(anchors), restrictive);
    // Every survivor must itself genuinely pass the restrictive constraints —
    // gap-fill can never smuggle in an exercise the same Gate 1 rule would reject.
    for (const ex of result.filtered) {
      expect(passesConstraints(ex, restrictive)).toBe(true);
    }
    // Total accounted for: real survivors + a real, honest shortfall count,
    // never silently fewer slots than the baseline asked for.
    expect(result.filtered.length + result.gapFillShortfall).toBeGreaterThanOrEqual(
      anchors.length - result.gate1Exclusions.filter((e) => e.excludedBy !== 'inactive').length
    );
  });

  it('throws on a baseline plan referencing an unknown exercise id — data corruption is loud, never a silently smaller session', () => {
    expect(() => filterAndSubstitute(makeBaselinePlan(['this-id-does-not-exist']), PERMISSIVE)).toThrow(
      /unknown exercise/
    );
  });

  it('force-add: draws at least one candidate of a forced type within the removed-slot budget when one is available', () => {
    const forcedType = 'cardio';
    const hasCardioCandidate = exerciseLibrary.all().some((e) => e.active && e.type === forcedType);
    if (!hasCardioCandidate) return;
    // One exercise guaranteed to be removed (equipment ceiling below what it needs).
    const removedAnchor = exerciseLibrary.all().find((e) => e.active && e.equipment === 'full_gym');
    if (!removedAnchor) return;
    const result = filterAndSubstitute(
      makeBaselinePlan([removedAnchor.id]),
      makeConstraints({ equipmentCeiling: 'none', forceAddTypes: [forcedType] })
    );
    expect(result.filtered.some((e) => e.type === forcedType)).toBe(true);
  });
});
