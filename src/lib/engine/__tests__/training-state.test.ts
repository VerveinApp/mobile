import {
  bodyAreaPriorityScore,
  getMostNeglectedBodyArea,
  tierOf,
  type TrainingState,
} from '@/lib/engine/training-state';
import type { BodyArea } from '@/lib/engine/types';

function makeTrainingState(overrides: {
  debtTier?: 'insufficient' | 'provisional' | 'established';
  debt?: Partial<Record<BodyArea, number>>;
  recencyTier?: 'insufficient' | 'provisional' | 'established';
  recency?: Partial<Record<BodyArea, number | null>>;
}): TrainingState {
  const zeroDebt = { full: 0, upper: 0, lower: 0, core: 0, ...overrides.debt };
  const nullRecency = { full: null, upper: null, lower: null, core: null, ...overrides.recency };
  return {
    capacityTrend: { value: 'stable', basis: 0, tier: 'insufficient' },
    rollingWindow: { value: { days: [], yesterdayLowEnergy: false, consecutiveLowDays: 0 }, basis: 0, tier: 'insufficient' },
    decisionMemory: { value: { runs: [], fallbackRate: 0 }, basis: 0, tier: 'insufficient' },
    stimulusLedger: {
      value: {
        full: { deliveredSets: 0, sessionsCounted: 0 },
        upper: { deliveredSets: 0, sessionsCounted: 0 },
        lower: { deliveredSets: 0, sessionsCounted: 0 },
        core: { deliveredSets: 0, sessionsCounted: 0 },
      },
      basis: 0,
      tier: 'insufficient',
    },
    stimulusDebt: {
      value: {
        full: { debtSets: zeroDebt.full, sessionsCounted: 1 },
        upper: { debtSets: zeroDebt.upper, sessionsCounted: 1 },
        lower: { debtSets: zeroDebt.lower, sessionsCounted: 1 },
        core: { debtSets: zeroDebt.core, sessionsCounted: 1 },
      },
      basis: 1,
      tier: overrides.debtTier ?? 'insufficient',
    },
    recency: {
      value: {
        full: { daysSinceTrained: nullRecency.full },
        upper: { daysSinceTrained: nullRecency.upper },
        lower: { daysSinceTrained: nullRecency.lower },
        core: { daysSinceTrained: nullRecency.core },
      },
      basis: 1,
      tier: overrides.recencyTier ?? 'insufficient',
    },
  };
}

describe('tierOf', () => {
  it('reports insufficient below the provisional threshold', () => {
    expect(tierOf(0)).toBe('insufficient');
    expect(tierOf(2)).toBe('insufficient');
  });
  it('reports provisional at and above the provisional threshold, below established', () => {
    expect(tierOf(3)).toBe('provisional');
    expect(tierOf(9)).toBe('provisional');
  });
  it('reports established at and above the established threshold', () => {
    expect(tierOf(10)).toBe('established');
    expect(tierOf(100)).toBe('established');
  });
});

describe('bodyAreaPriorityScore', () => {
  it('weighs real debt far above a recency tiebreak (debt dominates)', () => {
    const state = makeTrainingState({
      debtTier: 'established',
      debt: { upper: 1, lower: 0 },
      recencyTier: 'established',
      recency: { upper: 0, lower: 999 },
    });
    // Even one real debtSet (worth 1000) must outrank the maximum capped
    // recency score (999) for an area with zero debt.
    expect(bodyAreaPriorityScore(state, 'upper')).toBeGreaterThan(bodyAreaPriorityScore(state, 'lower'));
  });

  it('treats a never-trained area (null days) as more overdue than any real observed gap, capped at 999', () => {
    const state = makeTrainingState({
      debtTier: 'insufficient',
      recencyTier: 'established',
      recency: { upper: null, lower: 500 },
    });
    expect(bodyAreaPriorityScore(state, 'upper')).toBeGreaterThan(bodyAreaPriorityScore(state, 'lower'));
  });

  it('ignores real debt/recency VALUES when their own tier is insufficient, per the same epistemic-humility rule as every other TrainingState reader — but note this does not zero the score', () => {
    const state = makeTrainingState({
      debtTier: 'insufficient',
      debt: { upper: 999 }, // must be ignored — tier says not enough evidence
      recencyTier: 'insufficient',
      recency: { upper: 0 }, // must be ignored too
    });
    // debtTier insufficient -> debt reads as 0 (not the real 999). recencyTier
    // insufficient -> days reads as null (not the real 0), and null is the
    // SAME sentinel this function uses for "genuinely never trained" — so an
    // insufficient recency tier scores as the max (1000), not zero. This is
    // real, existing, verbatim-preserved behavior from before this function
    // was extracted, not something to "fix": with both tiers insufficient,
    // every area scores identically (flat 1000), which is exactly why
    // getMostNeglectedBodyArea has its OWN separate insufficient-evidence
    // guard rather than trusting this function to naturally return a
    // differentiating value in that case.
    expect(bodyAreaPriorityScore(state, 'upper')).toBe(1000);
    expect(bodyAreaPriorityScore(state, 'lower')).toBe(1000);
  });
});

describe('getMostNeglectedBodyArea', () => {
  it('returns null with no trainingState at all', () => {
    expect(getMostNeglectedBodyArea(undefined)).toBeNull();
  });

  it('returns null when neither debt nor recency has real evidence yet', () => {
    const state = makeTrainingState({ debtTier: 'insufficient', recencyTier: 'insufficient' });
    expect(getMostNeglectedBodyArea(state)).toBeNull();
  });

  it('picks the real highest-scoring area, including when it is the first array element (full)', () => {
    const state = makeTrainingState({
      debtTier: 'established',
      debt: { full: 10, upper: 1, lower: 1, core: 1 },
      recencyTier: 'insufficient',
    });
    // Regression guard for Array.prototype.reduce with no seed: 'full' is
    // BODY_AREAS[0], so it becomes the initial accumulator — must still be
    // correctly reported as the winner, not silently skipped because it was
    // never "compared" as a candidate.
    expect(getMostNeglectedBodyArea(state)).toBe('full');
  });

  it('picks a non-first area correctly too', () => {
    const state = makeTrainingState({
      debtTier: 'established',
      debt: { full: 0, upper: 0, lower: 5, core: 0 },
      recencyTier: 'insufficient',
    });
    expect(getMostNeglectedBodyArea(state)).toBe('lower');
  });
});
