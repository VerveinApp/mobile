import {
  bodyAreaPriorityScore,
  compileTrainingState,
  getMostNeglectedBodyArea,
  tierOf,
  type MinimalCheckIn,
  type MinimalDecisionTrace,
  type TrainingState,
} from '@/lib/engine/training-state';
import type { BodyArea } from '@/lib/engine/types';

// Real library exercises, one per body area, all with base_sets: 3 — picked
// so arithmetic in the ledger/debt tests below stays simple and every
// resolved body_area is unambiguous (compileTrainingState resolves ids
// through the real exerciseLibrary singleton, not a mock).
const LOWER_EX = 'ex_101'; // Barbell Back Squat, base_sets: 3
const UPPER_EX = 'ex_105'; // Standing Barbell Overhead Press, base_sets: 3
const CORE_EX = 'ex_127'; // Pallof Press (Cable), base_sets: 3
const FULL_EX = 'ex_103'; // Conventional Deadlift (Barbell), base_sets: 3

function checkIn(date: string, energyScore: number, skipped = false): MinimalCheckIn {
  return { date, energyScore, skipped };
}

function trace(
  date: string,
  overrides: Partial<Omit<MinimalDecisionTrace, 'date'>> = {}
): MinimalDecisionTrace {
  return {
    date,
    fallbackFired: false,
    gate1Exclusions: [],
    output: { exercises: [] },
    ...overrides,
  };
}

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

function dateOffset(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const REF = '2026-06-20';

describe('compileTrainingState', () => {
  it('returns safe, all-insufficient defaults with no history at all', () => {
    const state = compileTrainingState({ checkIns: [], traces: [], referenceDate: REF });
    expect(state.capacityTrend).toEqual({ value: 'stable', basis: 0, tier: 'insufficient' });
    expect(state.rollingWindow.tier).toBe('insufficient');
    expect(state.rollingWindow.value).toEqual({ days: [], yesterdayLowEnergy: false, consecutiveLowDays: 0 });
    expect(state.decisionMemory).toEqual({ value: { runs: [], fallbackRate: 0 }, basis: 0, tier: 'insufficient' });
    expect(state.stimulusLedger.tier).toBe('insufficient');
    expect(state.stimulusDebt.tier).toBe('insufficient');
    expect(state.recency.tier).toBe('insufficient');
    for (const area of ['full', 'upper', 'lower', 'core'] as BodyArea[]) {
      expect(state.stimulusDebt.value[area]).toEqual({ debtSets: 0, sessionsCounted: 0 });
      expect(state.recency.value[area]).toEqual({ daysSinceTrained: null });
    }
  });

  it('excludes a check-in dated on or after the reference date — only strictly-prior history counts', () => {
    const checkIns = [checkIn(dateOffset(REF, -1), 4), checkIn(REF, 1), checkIn(dateOffset(REF, 1), 1)];
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.rollingWindow.value.days).toHaveLength(1);
    expect(state.rollingWindow.value.days[0].date).toBe(dateOffset(REF, -1));
  });

  it('capacityTrend stays insufficient below a 5-day window even once basis alone would clear the provisional threshold — REGRESSION GUARD: the trend VALUE only becomes a real computation at window.length >= 5, so reporting tierOf(basis) directly at basis=4 would claim a real trend off an untouched default', () => {
    const checkIns = [1, 2, 3, 4].map((i) => checkIn(dateOffset(REF, -i), 3));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.capacityTrend.basis).toBe(4);
    expect(state.capacityTrend.tier).toBe('insufficient');
  });

  it('capacityTrend reports a real tier once the window reaches 5 — provisional at exactly 5 (below the established threshold of 10)', () => {
    const checkIns = [1, 2, 3, 4, 5].map((i) => checkIn(dateOffset(REF, -i), 3));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.capacityTrend.basis).toBe(5);
    expect(state.capacityTrend.tier).toBe('provisional');
  });

  it('capacityTrend reports "improving" when the most recent 3 days average meaningfully higher than the prior days in the window', () => {
    // Window (oldest->newest, 7 days): earlier 4 average 2, recent 3 average 4 -> delta 2, well past TREND_DELTA (0.5).
    const energies = [2, 2, 2, 2, 4, 4, 4];
    const checkIns = energies.map((e, i) => checkIn(dateOffset(REF, -(energies.length - i)), e));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.capacityTrend.value).toBe('improving');
  });

  it('capacityTrend reports "declining" when the most recent 3 days average meaningfully lower', () => {
    const energies = [4, 4, 4, 4, 2, 2, 2];
    const checkIns = energies.map((e, i) => checkIn(dateOffset(REF, -(energies.length - i)), e));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.capacityTrend.value).toBe('declining');
  });

  it('capacityTrend reports "stable" when the swing is within TREND_DELTA either way', () => {
    const energies = [3, 3, 3, 3, 3, 3, 3];
    const checkIns = energies.map((e, i) => checkIn(dateOffset(REF, -(energies.length - i)), e));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.capacityTrend.value).toBe('stable');
  });

  it('only folds the trailing ROLLING_WINDOW_N (7) days into the window, even with much longer real history', () => {
    const checkIns = Array.from({ length: 20 }, (_, i) => checkIn(dateOffset(REF, -(20 - i)), 3));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.rollingWindow.value.days).toHaveLength(7);
    expect(state.rollingWindow.value.days[0].date).toBe(dateOffset(REF, -7));
    expect(state.rollingWindow.value.days[6].date).toBe(dateOffset(REF, -1));
  });

  it('yesterdayLowEnergy is true only when yesterday has a real logged entry at energy <= 2', () => {
    const low = compileTrainingState({
      checkIns: [checkIn(dateOffset(REF, -1), 2)],
      traces: [],
      referenceDate: REF,
    });
    expect(low.rollingWindow.value.yesterdayLowEnergy).toBe(true);

    const notLow = compileTrainingState({
      checkIns: [checkIn(dateOffset(REF, -1), 3)],
      traces: [],
      referenceDate: REF,
    });
    expect(notLow.rollingWindow.value.yesterdayLowEnergy).toBe(false);

    const noEntry = compileTrainingState({
      checkIns: [checkIn(dateOffset(REF, -2), 1)],
      traces: [],
      referenceDate: REF,
    });
    expect(noEntry.rollingWindow.value.yesterdayLowEnergy).toBe(false);
  });

  it('consecutiveLowDays counts backward from the most recent day in the window and stops at the first non-low day', () => {
    // Oldest->newest: 1(low), 4(breaks streak), 2,1,2 (three consecutive low days at the end).
    const energies = [1, 4, 2, 1, 2];
    const checkIns = energies.map((e, i) => checkIn(dateOffset(REF, -(energies.length - i)), e));
    const state = compileTrainingState({ checkIns, traces: [], referenceDate: REF });
    expect(state.rollingWindow.value.consecutiveLowDays).toBe(3);
  });

  it('decisionMemory computes fallbackRate over the trailing DECISION_MEMORY_N (7) traces only', () => {
    const traces = [
      trace(dateOffset(REF, -10), { fallbackFired: true }), // outside the trailing-7 window
      ...Array.from({ length: 6 }, (_, i) => trace(dateOffset(REF, -(6 - i)), { fallbackFired: false })),
      trace(REF, { fallbackFired: true }),
    ];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: dateOffset(REF, 1) });
    expect(state.decisionMemory.basis).toBe(7);
    expect(state.decisionMemory.value.fallbackRate).toBeCloseTo(1 / 7, 10);
  });

  it('stimulusLedger sums adapted_sets per body area across non-fallback traces, and counts one session per area actually touched', () => {
    const traces = [
      trace(dateOffset(REF, -2), {
        output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }, { exerciseId: UPPER_EX, adapted_sets: 2 }] },
      }),
      trace(dateOffset(REF, -1), {
        output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 2 }] },
      }),
      // A fallback-fired trace must never contribute to the ledger, even
      // though its output carries real exercises.
      trace(REF, { fallbackFired: true, output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 5 }] } }),
    ];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: dateOffset(REF, 1) });
    expect(state.stimulusLedger.value.lower).toEqual({ deliveredSets: 5, sessionsCounted: 2 });
    expect(state.stimulusLedger.value.upper).toEqual({ deliveredSets: 2, sessionsCounted: 1 });
    expect(state.stimulusLedger.value.core).toEqual({ deliveredSets: 0, sessionsCounted: 0 });
    expect(state.stimulusLedger.basis).toBe(2);
  });

  it('stimulusDebt combines full base_sets for a Gate 1-excluded exercise with the real shortfall for a delivered-but-reduced one', () => {
    const traces = [
      trace(dateOffset(REF, -1), {
        gate1Exclusions: [{ exerciseId: CORE_EX, excludedBy: 'intensity' }], // full 3 base_sets owed
        output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 1 }] }, // base_sets 3, adapted 1 -> 2 owed
      }),
    ];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.stimulusDebt.value.core).toEqual({ debtSets: 3, sessionsCounted: 1 });
    expect(state.stimulusDebt.value.lower).toEqual({ debtSets: 2, sessionsCounted: 1 });
  });

  it('stimulusDebt never goes negative when a session delivers MORE sets than baseline (e.g. an accepted finisher)', () => {
    const traces = [trace(dateOffset(REF, -1), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 5 }] } })];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.stimulusDebt.value.lower.debtSets).toBe(0);
  });

  it('stimulusLedger/stimulusDebt only fold the trailing LEDGER_WINDOW_N (14) non-fallback traces', () => {
    const traces = Array.from({ length: 20 }, (_, i) =>
      trace(dateOffset(REF, -(20 - i)), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }] } })
    );
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: dateOffset(REF, 1) });
    expect(state.stimulusLedger.basis).toBe(14);
    expect(state.stimulusDebt.basis).toBe(14);
  });

  it('recency reports the most recent occurrence across EVERY retained trace, not just the shorter ledger window', () => {
    // 20 traces total, only the oldest one ever trains "upper" — outside the
    // 14-trace ledger window, but recency must still find it.
    const traces = [
      trace(dateOffset(REF, -20), { output: { exercises: [{ exerciseId: UPPER_EX, adapted_sets: 3 }] } }),
      ...Array.from({ length: 19 }, (_, i) =>
        trace(dateOffset(REF, -(19 - i)), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }] } })
      ),
    ];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: dateOffset(REF, 1) });
    expect(state.recency.value.upper.daysSinceTrained).toBe(21);
    expect(state.recency.basis).toBe(20);
  });

  it('recency takes the LAST (most recent) occurrence per area, not the first, given oldest->newest ordering', () => {
    const traces = [
      trace(dateOffset(REF, -10), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }] } }),
      trace(dateOffset(REF, -3), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }] } }),
    ];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.recency.value.lower.daysSinceTrained).toBe(3);
  });

  it('recency is null for a body area that has never appeared in any non-fallback trace', () => {
    const traces = [trace(dateOffset(REF, -1), { output: { exercises: [{ exerciseId: LOWER_EX, adapted_sets: 3 }] } })];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.recency.value.upper.daysSinceTrained).toBeNull();
    expect(state.recency.value.core.daysSinceTrained).toBeNull();
    expect(state.recency.value.full.daysSinceTrained).toBeNull();
  });

  it('recency ignores a fallback-fired trace even if its output carries real exercises', () => {
    const traces = [trace(dateOffset(REF, -1), { fallbackFired: true, output: { exercises: [{ exerciseId: FULL_EX, adapted_sets: 3 }] } })];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.recency.value.full.daysSinceTrained).toBeNull();
    expect(state.recency.basis).toBe(0);
  });

  it('resolves ex.id as a fallback key when ex.exerciseId is absent — the safety-pair shape (Exercise, not ScaledExercise) uses id, not exerciseId', () => {
    const traces = [trace(dateOffset(REF, -1), { output: { exercises: [{ id: FULL_EX, adapted_sets: 3 }] } })];
    const state = compileTrainingState({ checkIns: [], traces, referenceDate: REF });
    expect(state.stimulusLedger.value.full).toEqual({ deliveredSets: 3, sessionsCounted: 1 });
  });
});
