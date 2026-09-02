import type { EffectiveConstraintSet, Exercise, ScaledExercise } from '@/lib/engine/types';

/** Minimal, valid Exercise — every field has a safe default so a test only
 * needs to override what it actually cares about. */
export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-ex-1',
    name: 'Test Exercise',
    type: 'strength',
    intensity: 'medium',
    impact: 'low',
    body_area: 'upper',
    complexity: 'simple',
    equipment: 'none',
    movement_patterns: ['push'],
    rep_structure: 'discrete',
    is_compound: 'accessory',
    laterality: 'bilateral',
    rom_demand: 'moderate',
    loads_lengthened: false,
    base_sets: 3,
    base_reps: 10,
    base_duration_min: 5,
    contraindications: [],
    active: true,
    ...overrides,
  };
}

export function makeScaledExercise(overrides: Partial<ScaledExercise> = {}): ScaledExercise {
  return {
    exerciseId: 'test-ex-1',
    name: 'Test Exercise',
    adapted_sets: 3,
    adapted_reps: 10,
    adapted_duration_min: 5,
    laterality: 'bilateral',
    ...overrides,
  };
}

/** A maximally permissive constraint set — nothing excluded. Tests override
 * only the dimension they're actually exercising. */
export function makeConstraints(overrides: Partial<EffectiveConstraintSet> = {}): EffectiveConstraintSet {
  return {
    intensityCeiling: 'high',
    impactCeiling: 'high',
    equipmentCeiling: 'full_gym',
    excludeBodyAreas: [],
    excludeMovementPatterns: [],
    forceAddTypes: [],
    excludeContraindicatedFor: [],
    ...overrides,
  };
}
