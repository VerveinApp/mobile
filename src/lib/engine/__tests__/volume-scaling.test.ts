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

  it('rounds adapted_duration_min to the nearest 5 minutes', () => {
    const ex = makeExercise({ base_duration_min: 8, base_sets: null });
    // energy 4 -> durationMultiplier 1.0, calibration 1 -> 8 * 1 = 8 -> round to nearest 5 -> 10
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[4], [], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.exercises[0].adapted_duration_min).toBe(10);
  });

  it('floors a duration that rounds to exactly 0 up to 1 minute — never presents a 0-minute exercise — while still flagging (in knownGaps) the documented 5-minute-rounding gap that produced it', () => {
    const ex = makeExercise({ base_duration_min: 4, base_sets: null, rep_structure: 'isometric_hold' });
    // energy 2 -> durationMultiplier 0.6, calibration 1 -> 4*0.6=2.4 -> round(2.4/5)*5 -> 0, floored to 1
    const result = scaleVolume([ex], ENERGY_MODIFIER_TABLE[2], [], 'standard', 1);
    if (result.kind !== 'scaled') throw new Error('expected scaled');
    expect(result.exercises[0].adapted_duration_min).toBe(1);
    expect(result.knownGaps.some((g) => g.includes('rounded to 0'))).toBe(true);
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
