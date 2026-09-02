import { computeEffectiveConstraints } from '@/lib/engine/constraint-resolution';
import type { ConstraintProfile, DailyCheckIn } from '@/lib/engine/types';

function makeCheckIn(overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
  return { userId: 'u', date: '2026-01-01', energyScore: 4, acuteSymptomTags: [], skipped: false, ...overrides };
}

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

describe('computeEffectiveConstraints (M5, Most Restrictive Wins)', () => {
  it('at Energy 4, no symptoms, permissive condition profile: ceilings stay wide open (high/high)', () => {
    const result = computeEffectiveConstraints(makeCheckIn({ energyScore: 4 }), makeConditionProfile(), [], [], 'full_gym', []);
    expect(result.intensityCeiling).toBe('high');
    expect(result.impactCeiling).toBe('high');
    expect(result.equipmentCeiling).toBe('full_gym');
    expect(result.excludeBodyAreas).toEqual([]);
    expect(result.excludeMovementPatterns).toEqual([]);
    expect(result.forceAddTypes).toEqual([]);
  });

  it('a low Energy score tightens the intensity/impact ceiling even when nothing else restricts', () => {
    const result = computeEffectiveConstraints(makeCheckIn({ energyScore: 2 }), makeConditionProfile(), [], [], 'full_gym', []);
    expect(result.intensityCeiling).toBe('low');
    expect(result.impactCeiling).toBe('low');
  });

  it('a tighter condition-profile impact ceiling wins over a looser energy-derived one', () => {
    const result = computeEffectiveConstraints(
      makeCheckIn({ energyScore: 4 }), // energy alone would allow impact 'high'
      makeConditionProfile({ impactCeiling: 'low' }),
      [], [], 'full_gym', []
    );
    expect(result.impactCeiling).toBe('low');
  });

  it('a looser condition-profile impact ceiling never loosens what energy already tightened (Most Restrictive Wins)', () => {
    const result = computeEffectiveConstraints(
      makeCheckIn({ energyScore: 2 }), // tightens impact to 'low'
      makeConditionProfile({ impactCeiling: 'high' }), // looser — must not win
      [], [], 'full_gym', []
    );
    expect(result.impactCeiling).toBe('low');
  });

  it('a standing symptom tag and an acute symptom tag both apply — union, not override', () => {
    const result = computeEffectiveConstraints(
      makeCheckIn({ energyScore: 4, acuteSymptomTags: ['joint_pain'] }),
      makeConditionProfile(),
      ['sore_legs'],
      [], 'full_gym', []
    );
    expect(result.impactCeiling).toBe('low'); // from joint_pain
    expect(result.excludeBodyAreas).toEqual(['lower']); // from sore_legs
  });

  it('a symptom-tag conditional override only fires when the energy threshold is actually crossed', () => {
    const below = computeEffectiveConstraints(makeCheckIn({ energyScore: 2, acuteSymptomTags: ['period'] }), makeConditionProfile(), [], [], 'full_gym', []);
    expect(below.intensityCeiling).toBe('low'); // period's "→ low if energy < 3" fires
    expect(below.forceAddTypes).toEqual(['mobility']);

    const atOrAbove = computeEffectiveConstraints(makeCheckIn({ energyScore: 4, acuteSymptomTags: ['period'] }), makeConditionProfile(), [], [], 'full_gym', []);
    expect(atOrAbove.intensityCeiling).toBe('high'); // conditional does not fire at energy 4
    expect(atOrAbove.forceAddTypes).toEqual(['mobility']); // unconditional forceAddType still applies
  });

  it('movement restrictions are carried straight through to excludeMovementPatterns', () => {
    const result = computeEffectiveConstraints(makeCheckIn(), makeConditionProfile(), [], ['squat', 'jump'], 'full_gym', []);
    expect(result.excludeMovementPatterns.sort()).toEqual(['jump', 'squat']);
  });

  it('throws on an unrecognized movement restriction rather than silently passing it through', () => {
    expect(() =>
      computeEffectiveConstraints(makeCheckIn(), makeConditionProfile(), [], ['not_a_real_pattern'], 'full_gym', [])
    ).toThrow(/unrecognized movement restriction/);
  });

  it('throws on an unrecognized symptom tag rather than silently passing it through', () => {
    expect(() =>
      computeEffectiveConstraints(makeCheckIn({ acuteSymptomTags: ['not_a_real_symptom'] }), makeConditionProfile(), [], [], 'full_gym', [])
    ).toThrow(/unrecognized symptom tag/);
  });

  it('deduplicates conditions passed into excludeContraindicatedFor', () => {
    const result = computeEffectiveConstraints(makeCheckIn(), makeConditionProfile(), [], [], 'full_gym', ['asthma', 'asthma']);
    expect(result.excludeContraindicatedFor).toEqual(['asthma']);
  });

  it('equipmentCeiling passes straight through from the argument, uninvolved in Most-Restrictive tightening', () => {
    const result = computeEffectiveConstraints(makeCheckIn(), makeConditionProfile(), [], [], 'none', []);
    expect(result.equipmentCeiling).toBe('none');
  });
});
