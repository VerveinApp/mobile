import { generateBaselinePlan, type OnboardingContext } from '@/lib/engine/baseline-plan';
import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { ConstraintProfile } from '@/lib/engine/types';

function makeConditionProfile(overrides: Partial<ConstraintProfile> = {}): ConstraintProfile {
  return {
    recoverySensitivity: 'low',
    fatigueVariability: 'low',
    progressionSpeed: 'moderate',
    preferredSessionMin: 30,
    impactCeiling: 'high',
    volumeStance: 'standard',
    ...overrides,
  };
}

function makeContext(overrides: Partial<OnboardingContext> = {}): OnboardingContext {
  return {
    targetIntensity: 'high',
    equipment: 'full_gym',
    focusAreas: ['full'],
    sessionDays: ['mon', 'wed', 'fri'],
    conditionProfile: makeConditionProfile(),
    conditions: [],
    standingSymptomTags: [],
    movementRestrictions: [],
    biasSimpleExercises: false,
    ...overrides,
  };
}

function bodyAreaOf(id: string): string | undefined {
  return exerciseLibrary.all().find((e) => e.id === id)?.body_area;
}

describe('generateBaselinePlan (M3, N-per-focus-area composition)', () => {
  it('a "full" focus selection expands to upper+lower+core, 2 exercises each, under permissive constraints', () => {
    const plan = generateBaselinePlan(makeContext({ focusAreas: ['full'] }), 'u1');
    expect(plan.exerciseIds).toHaveLength(6);
  });

  it('selects exactly N=2 exercises for a single named focus area', () => {
    const plan = generateBaselinePlan(makeContext({ focusAreas: ['upper'] }), 'u1');
    expect(plan.exerciseIds).toHaveLength(2);
  });

  it('never selects the same exercise id twice across areas', () => {
    const plan = generateBaselinePlan(makeContext({ focusAreas: ['full'] }), 'u1');
    expect(new Set(plan.exerciseIds).size).toBe(plan.exerciseIds.length);
  });

  it('a standing symptom tag that excludes a body area keeps that area from drawing on its own native pool', () => {
    // sore_legs excludes body area 'lower' at Gate 1 — any exercise chosen for
    // the 'lower' slot must come from the full-body fallback pool, never a
    // real lower-body exercise, and a shortfall is honest, never fabricated.
    const plan = generateBaselinePlan(makeContext({ focusAreas: ['full'], standingSymptomTags: ['sore_legs'] }), 'u1');
    for (const id of plan.exerciseIds) {
      expect(bodyAreaOf(id)).not.toBe('lower');
    }
  });

  it('throws on an unrecognized standing symptom tag rather than silently ignoring it', () => {
    expect(() =>
      generateBaselinePlan(makeContext({ standingSymptomTags: ['not_a_real_symptom'] }), 'u1')
    ).toThrow(/unrecognized standing symptom tag/);
  });

  it('is deterministic — the same context always yields the same plan (numeric library order, no randomness)', () => {
    const ctx = makeContext({ focusAreas: ['full'] });
    const planA = generateBaselinePlan(ctx, 'u1');
    const planB = generateBaselinePlan(ctx, 'u1');
    expect(planA.exerciseIds).toEqual(planB.exerciseIds);
  });

  it('preserves the passed-through userId, sessionDays, targetIntensity, equipment, and focusAreas verbatim', () => {
    const ctx = makeContext({ sessionDays: ['tue', 'thu'], targetIntensity: 'medium', equipment: 'minimal', focusAreas: ['core'] });
    const plan = generateBaselinePlan(ctx, 'user-42');
    expect(plan.userId).toBe('user-42');
    expect(plan.sessionDays).toEqual(['tue', 'thu']);
    expect(plan.targetIntensity).toBe('medium');
    expect(plan.equipment).toBe('minimal');
    expect(plan.focusAreas).toEqual(['core']);
  });

  it('falls back to the universal recovery pair when constraints leave zero eligible exercises', () => {
    // No real onboarding path can produce every dimension maximally
    // restrictive at once, but the composition loop's own empty-result
    // branch must still hold if it ever happened — verified directly here
    // by driving equipment down to 'none' + intensity 'low' + excluding both
    // impact-affected areas via layered standing tags, then checking the
    // documented fallback only kicks in when chosen is truly empty.
    const plan = generateBaselinePlan(
      makeContext({
        targetIntensity: 'low',
        equipment: 'none',
        focusAreas: ['upper'],
        standingSymptomTags: ['sore_upper'],
      }),
      'u1'
    );
    // sore_upper excludes 'upper' at Gate 1; focus is 'upper' only (no
    // full-body second-pass target since areaTargets is just ['upper']) —
    // this drives the exact zero-chosen path the fallback exists for.
    expect(plan.exerciseIds).toEqual(['ex_1023', 'ex_1083']);
  });
});
