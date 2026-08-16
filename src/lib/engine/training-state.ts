/**
 * M20 — Training State Compiler, ported from the adaptive-engine research
 * vault's src/modules/m20-training-state.ts. The longitudinal twin of
 * constraint-resolution.ts (M5):
 *
 *   EffectiveConstraintSet — what TODAY permits   (M5, from today's inputs)
 *   TrainingState          — what HISTORY implies (M20, from the event log)
 *
 * A pure, single-writer fold: compileTrainingState(history) → TrainingState.
 * Computed fresh per call, never persisted as its own row, no wall-clock
 * reads — the reference date is caller-supplied. Every field carries
 * { value, basis, tier }: deterministic epistemic humility, so a 2-day-old
 * account never gets shown a confident "declining trend" claim off 2 data
 * points — see tierOf below.
 *
 * TYPE NARROWING FROM THE SOURCE — the real module takes `DailyCheckIn[]`
 * and `DecisionTrace[]`, most of whose fields this app either doesn't
 * collect (userId, a real per-historical-day symptom-tag record) or doesn't
 * persist (inputSnapshot, gate2Applications, explanationMapping,
 * knownGapsSurfaced — M12's full trace was deliberately not ported). Rather
 * than fabricate placeholder values to satisfy the wider real types, the
 * signature here is narrowed to exactly the fields the fold actually reads
 * — MinimalCheckIn and MinimalDecisionTrace below. The fold logic itself is
 * unchanged from the source.
 */

import type { BodyArea } from '@/lib/engine/types';
import {
  DECISION_MEMORY_N,
  LEDGER_WINDOW_N,
  ROLLING_WINDOW_N,
  TIER_ESTABLISHED_MIN,
  TIER_PROVISIONAL_MIN,
  TREND_DELTA,
} from '@/lib/engine/reference/policy-parameters';
import { exerciseLibrary } from '@/lib/engine/exercise-library';

export type EvidenceTier = 'insufficient' | 'provisional' | 'established';
export type Tiered<T> = { value: T; basis: number; tier: EvidenceTier };

export type MinimalCheckIn = { date: string; energyScore: number; skipped: boolean };
export type MinimalDecisionTrace = {
  fallbackFired: boolean;
  gate1Exclusions: { exerciseId: string; excludedBy: string }[];
  output: { exercises: { exerciseId?: string; id?: string; adapted_sets?: number }[] };
};

export type TrainingState = {
  /** Direction of the energy series over the rolling window. Trace-visible only — no approved explanation template exists in the source project either. */
  capacityTrend: Tiered<'improving' | 'stable' | 'declining'>;
  rollingWindow: Tiered<{
    days: { date: string; energyScore: number; skipped: boolean }[];
    yesterdayLowEnergy: boolean;
    consecutiveLowDays: number;
  }>;
  decisionMemory: Tiered<{
    runs: { fallbackFired: boolean; exclusions: number }[];
    fallbackRate: number;
  }>;
  /** Delivered dose by body area, over the trailing LEDGER_WINDOW_N non-fallback runs. */
  stimulusLedger: Tiered<Record<BodyArea, { deliveredSets: number; sessionsCounted: number }>>;
  /** Per-body-area shortfall — sets a session's baseline plan implied but Gate 1/2 did not deliver, over the same window. */
  stimulusDebt: Tiered<Record<BodyArea, { debtSets: number; sessionsCounted: number }>>;
};

function tierOf(basis: number): EvidenceTier {
  if (basis >= TIER_ESTABLISHED_MIN) return 'established';
  if (basis >= TIER_PROVISIONAL_MIN) return 'provisional';
  return 'insufficient';
}

function previousCalendarDay(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`) - 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

const EMPTY_BODY_AREA_RECORD = <T extends Record<string, number>>(zero: T): Record<BodyArea, T> => ({
  full: { ...zero },
  upper: { ...zero },
  lower: { ...zero },
  core: { ...zero },
});

export function compileTrainingState(history: {
  /** Check-ins strictly BEFORE the reference date, oldest→newest. */
  checkIns: MinimalCheckIn[];
  /** Recent stored traces, oldest→newest. */
  traces: MinimalDecisionTrace[];
  /** The date of the run being decided — supplied, never read from a clock. */
  referenceDate: string;
}): TrainingState {
  const prior = history.checkIns.filter((c) => c.date < history.referenceDate);
  const window = prior.slice(-ROLLING_WINDOW_N);

  // --- Capacity Trend: mean(last 3) vs mean(prior 4) of the window ---
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (window.length >= 5) {
    const recent = window.slice(-3).map((c) => c.energyScore);
    const earlier = window.slice(0, -3).map((c) => c.energyScore);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const delta = mean(recent) - mean(earlier);
    if (delta > TREND_DELTA) trend = 'improving';
    else if (delta < -TREND_DELTA) trend = 'declining';
  }

  // --- Rolling Window ---
  const yesterday = previousCalendarDay(history.referenceDate);
  const yRow = window.find((c) => c.date === yesterday);
  let consecutiveLow = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i].energyScore <= 2) consecutiveLow++;
    else break;
  }

  // --- Decision Memory ---
  const recentTraces = history.traces.slice(-DECISION_MEMORY_N);
  const runs = recentTraces.map((t) => ({ fallbackFired: t.fallbackFired, exclusions: t.gate1Exclusions.length }));
  const fallbackRate = runs.length > 0 ? runs.filter((r) => r.fallbackFired).length / runs.length : 0;

  // --- Stimulus Ledger ---
  const stimulusLedgerValue = EMPTY_BODY_AREA_RECORD({ deliveredSets: 0, sessionsCounted: 0 });
  const ledgerTraces = history.traces.filter((t) => !t.fallbackFired).slice(-LEDGER_WINDOW_N);
  for (const trace of ledgerTraces) {
    const areasTouchedThisRun = new Set<BodyArea>();
    for (const ex of trace.output.exercises) {
      const exerciseId = ex.exerciseId ?? ex.id;
      const libraryExercise = exerciseId ? exerciseLibrary.getById(exerciseId) : null;
      if (!libraryExercise) continue;
      areasTouchedThisRun.add(libraryExercise.body_area);
      if (typeof ex.adapted_sets === 'number') {
        stimulusLedgerValue[libraryExercise.body_area].deliveredSets += ex.adapted_sets;
      }
    }
    for (const area of areasTouchedThisRun) {
      stimulusLedgerValue[area].sessionsCounted += 1;
    }
  }
  const ledgerBasis = ledgerTraces.length;

  // --- Stimulus Debt (same ledgerTraces window, deliberately reused) ---
  const stimulusDebtValue = EMPTY_BODY_AREA_RECORD({ debtSets: 0, sessionsCounted: 0 });
  for (const trace of ledgerTraces) {
    const areasTouchedThisRun = new Set<BodyArea>();
    for (const excl of trace.gate1Exclusions) {
      const libraryExercise = exerciseLibrary.getById(excl.exerciseId);
      if (!libraryExercise) continue;
      areasTouchedThisRun.add(libraryExercise.body_area);
      if (typeof libraryExercise.base_sets === 'number') {
        stimulusDebtValue[libraryExercise.body_area].debtSets += libraryExercise.base_sets;
      }
    }
    for (const ex of trace.output.exercises) {
      const exerciseId = ex.exerciseId ?? ex.id;
      const libraryExercise = exerciseId ? exerciseLibrary.getById(exerciseId) : null;
      if (!libraryExercise) continue;
      areasTouchedThisRun.add(libraryExercise.body_area);
      if (typeof libraryExercise.base_sets === 'number' && typeof ex.adapted_sets === 'number') {
        stimulusDebtValue[libraryExercise.body_area].debtSets += Math.max(0, libraryExercise.base_sets - ex.adapted_sets);
      }
    }
    for (const area of areasTouchedThisRun) {
      stimulusDebtValue[area].sessionsCounted += 1;
    }
  }
  const debtBasis = ledgerTraces.length;

  return {
    capacityTrend: { value: trend, basis: window.length, tier: tierOf(window.length) },
    rollingWindow: {
      value: {
        days: window.map((c) => ({ date: c.date, energyScore: c.energyScore, skipped: c.skipped })),
        yesterdayLowEnergy: yRow !== undefined && yRow.energyScore <= 2,
        consecutiveLowDays: consecutiveLow,
      },
      basis: window.length,
      tier: tierOf(window.length),
    },
    decisionMemory: {
      value: { runs, fallbackRate },
      basis: runs.length,
      tier: tierOf(runs.length),
    },
    stimulusLedger: { value: stimulusLedgerValue, basis: ledgerBasis, tier: tierOf(ledgerBasis) },
    stimulusDebt: { value: stimulusDebtValue, basis: debtBasis, tier: tierOf(debtBasis) },
  };
}
