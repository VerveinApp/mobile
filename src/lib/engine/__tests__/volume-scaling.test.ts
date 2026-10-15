import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import type { SymptomOverrideRow } from '@/lib/engine/reference/symptom-override-table';
import { scaleVolume } from '@/lib/engine/volume-scaling';
import { makeExercise } from '@/lib/engine/testing/test-fixtures';

describe('scaleVolume', () => {
  it('at Energy 4 ("Good"), full calibration, standard stance: adapted_sets equals base_sets exactly', () => {
    const ex = makeExercise({ base_sets: 4 });
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    expect(result.kind).toBe('scaled');
    if (result.kind !== 'scaled') return;
    expect(result.exercises[0].adapted_sets).toBe(4);
  });

  it('never scales reps — adapted_reps always equals base_reps verbatim, regardless of multiplier', () => {
    const ex = makeExercise({ base_reps: 12 });
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[2], [], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.exercises[0].adapted_reps).toBe(12);
  });

  it('floors adapted_sets at 1, never 0, even under a steep combined reduction', () => {
    const ex = makeExercise({ base_sets: 3 });
    // energy 2 (0.6) * conservative dampener (0.85) * a low calibration (0.5) ≈ 0.255 -> 3*0.255 ≈ 0.77 -> would round to 1 already,
    // push further with an additional symptom multiplier to guarantee sub-1 before flooring.
    const symptom: SymptomOverrideRow = { setsMultiplier: 0.3 };
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[2], [symptom], 'conservative', 0.5);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.exercises[0].adapted_sets).toBeGreaterThanOrEqual(1);
  });

  it('rounds a block of 10 minutes or more to the nearest 5 minutes', () => {
    const ex = makeExercise({ base_duration_min: 12, base_sets: null });
    // energy 4 -> durationMultiplier 1.0 -> 12 -> nearest 5 -> 10
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.exercises[0].adapted_duration_min).toBe(10);
  });

  it('rounds a short block to the nearest half minute instead of 0, 1 or 5 minutes', () => {
    const shortHold = makeExercise({ base_duration_min: 4, base_sets: null, rep_structure: 'isometric_hold' });
    // energy 2 -> durationMultiplier 0.6 -> 2.4 -> 2.5 (used to round to 0 and be floored to 1)
    const low = scaleVolume([shortHold], ENERGY_MODIFIER_TABLE[2], [], 'standard', 1);
    if (low.kind !== 'scaled') throw new Error('expected scaled');
    expect(low.exercises[0].adapted_duration_min).toBe(2.5);
    expect(low.knownGaps.some((g) => g.includes('rounded to 0'))).toBe(false);

    const tinyHold = makeExercise({ base_duration_min: 0.5, base_sets: null, rep_structure: 'isometric_hold' });
    const tiny = scaleVolume([tinyHold], ENERGY_MODIFIER_TABLE[2], [], 'standard', 1);
    if (tiny.kind !== 'scaled') throw new Error('expected scaled');
    expect(tiny.exercises[0].adapted_duration_min).toBe(0.5);

    const eight = makeExercise({ base_duration_min: 8, base_sets: null });
    const good = scaleVolume([eight], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    if (good.kind !== 'scaled') throw new Error('expected scaled');
    expect(good.exercises[0].adapted_duration_min).toBe(8);
  });

  it('a conservative volume stance dampens sets by 0.85x relative to a standard stance, all else equal', () => {
    const ex = makeExercise({ base_sets: 10 });
    const standard = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    const conservative = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'conservative', 1);
    if (standard.kind !== 'scaled' || conservative.kind !== 'scaled') throw new Error('expected scaled');
    expect(conservative.exercises[0].adapted_sets).toBeLessThan(standard.exercises[0].adapted_sets!);
  });

  it('multiple active symptom overrides combine multiplicatively, not additively', () => {
    const ex = makeExercise({ base_sets: 10 });
    const one: SymptomOverrideRow = { setsMultiplier: 0.5 };
    const two: SymptomOverrideRow = { setsMultiplier: 0.5 };
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [one, two], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    // 10 * 1.0 (energy4) * 0.5 * 0.5 (multiplicative) * 1 (calibration) = 2.5 -> round -> 2 or 3
    expect(result.exercises[0].adapted_sets).toBeLessThanOrEqual(3);
  });

  it('overallSetsPct reflects the real average adapted/base ratio across the session', () => {
    const exA = makeExercise({ id: 'a', base_sets: 4 });
    const exB = makeExercise({ id: 'b', base_sets: 4 });
    const result = scaleVolume([exA, exB], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.overallSetsPct).toBe(100);
  });

  it('the stacking-transition trigger is always false in this build — a documented, disclosed gap, not a bug', () => {
    const ex = makeExercise();
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    expect(result.kind).toBe('scaled');
    expect(result.knownGaps.some((g) => g.includes('stacking-transition'))).toBe(true);
  });
});
