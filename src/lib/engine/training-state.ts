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
  /** Needed by recency's per-body-area "days since" computation below — every
   * real caller (decision-trace-log.ts's StoredTrace) already carries this,
   * so widening the type costs nothing at the one call site. */
  date: string;
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
  /**
   * Vervein addition, not in the vault (FE's own "Recency Reader" candidate
   * #7, which the vault marks unblocked but never ported — see the Master
   * Evolution Roadmap's §6.9: "the cheapest genuinely physiological state
   * field"). Days since each body area last appeared in a delivered,
   * non-fallback session's output — null when the retained trace log (30
   * entries, decision-trace-log.ts's MAX_ENTRIES) has no record of it at
   * all, never a fabricated "0" or "never." Looks across every retained
   * trace, not just the trailing LEDGER_WINDOW_N — an area last trained 20
   * sessions ago is real information the ledger's own shorter window would
   * otherwise silently drop.
   */
  recency: Tiered<Record<BodyArea, { daysSinceTrained: number | null }>>;
};

/**
 * Exported (Vervein addition — the vault's own M20 keeps this private, since
 * every Tiered field it produces is internal to this module) so other
 * Vervein-side evidence-tier reads can share the exact same thresholds
 * instead of re-declaring them. First real reuse: calibration's own
 * evidence tier — UserCalibration (engine/types.ts, M15) is a vault type and
 * deliberately isn't touched here to carry a `tier` field of its own (same
 * "derive it at the call site, don't mutate the vault schema" pattern
 * stimulusDebt/recency already follow), but `tierOf(calibration.sampleCount)`
 * gives any Vervein-side caller the identical tier a TrainingState field
 * would report, without duplicating TIER_PROVISIONAL_MIN/TIER_ESTABLISHED_MIN
 * as a second, driftable copy (see (tabs)/index.tsx's calibrationNote, which
 * inlined this exact `>= 10` check before this export existed).
 */
export function tierOf(basis: number): EvidenceTier {
  if (basis >= TIER_ESTABLISHED_MIN) return 'established';
  if (basis >= TIER_PROVISIONAL_MIN) return 'provisional';
  return 'insufficient';
}

const BODY_AREAS: BodyArea[] = ['full', 'upper', 'lower', 'core'];

/**
 * Vervein addition — the exact "which body area needs attention most"
 * priority score plan-preview.ts's own reorderByBodyAreaPriority (M13-level,
 * not in the vault) already computed inline to decide which area leads
 * today's exercise order. Pulled out here, the one place TrainingState's
 * own fields are defined, so a second real reader (session-reminders.ts's
 * neglected-area wording) can share the identical formula instead of a
 * second, driftable copy of it — both should always agree on which area is
 * "most behind," never quietly diverge. Debt dominates recency in the score
 * below — a real accumulated shortfall outranks a tiebreak. Never-trained
 * (daysSinceTrained: null) ranks as more overdue than any real observed
 * gap, capped at 999 so one real debtSet always outweighs the recency
 * tiebreak rather than the reverse.
 */
export function bodyAreaPriorityScore(trainingState: TrainingState, area: BodyArea): number {
  const debtTier = trainingState.stimulusDebt.tier;
  const recencyTier = trainingState.recency.tier;
  const debt = debtTier !== 'insufficient' ? trainingState.stimulusDebt.value[area].debtSets : 0;
  const days = recencyTier !== 'insufficient' ? trainingState.recency.value[area].daysSinceTrained : null;
  const recencyScore = days === null ? 1000 : Math.min(days, 999);
  return debt * 1000 + recencyScore;
}

/**
 * The single most-neglected body area, or null when neither stimulusDebt
 * nor recency has enough evidence yet to say anything real — same
 * epistemic-humility rule as every other TrainingState reader in this
 * codebase (see reorderByBodyAreaPriority's own matching guard in
 * plan-preview.ts). session-reminders.ts's own neglected-area wording is
 * the first real caller alongside plan-preview.ts's per-exercise sort.
 */
export function getMostNeglectedBodyArea(trainingState: TrainingState | undefined): BodyArea | null {
  if (!trainingState) return null;
  if (trainingState.stimulusDebt.tier === 'insufficient' && trainingState.recency.tier === 'insufficient') {
    return null;
  }
  return BODY_AREAS.reduce((best, area) =>
    bodyAreaPriorityScore(trainingState, area) > bodyAreaPriorityScore(trainingState, best) ? area : best
  );
}

function previousCalendarDay(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`) - 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

const EMPTY_BODY_AREA_RECORD = <T extends Record<string, unknown>>(zero: T): Record<BodyArea, T> => ({
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

  // --- Recency (Vervein addition — see the field's own doc comment above) ---
  // Every retained trace, not just ledgerTraces' shorter window — an area
  // untouched for 20 sessions is exactly the case this field exists to catch.
  const lastTrainedDate = EMPTY_BODY_AREA_RECORD<{ date: string | null }>({ date: null });
  const nonFallbackTraces = history.traces.filter((t) => !t.fallbackFired);
  for (const trace of nonFallbackTraces) {
    for (const ex of trace.output.exercises) {
      const exerciseId = ex.exerciseId ?? ex.id;
      const libraryExercise = exerciseId ? exerciseLibrary.getById(exerciseId) : null;
      if (!libraryExercise) continue;
      const area = libraryExercise.body_area;
      // Traces arrive oldest→newest (same ordering contract as checkIns per
      // this function's own param comment), so the last write per area is
      // always the most recent one — no date comparison needed.
      lastTrainedDate[area].date = trace.date;
    }
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const referenceMs = Date.parse(`${history.referenceDate}T00:00:00Z`);
  const recencyValue = EMPTY_BODY_AREA_RECORD<{ daysSinceTrained: number | null }>({ daysSinceTrained: null });
  (Object.keys(lastTrainedDate) as BodyArea[]).forEach((area) => {
    const date = lastTrainedDate[area].date;
    recencyValue[area].daysSinceTrained =
      date === null ? null : Math.round((referenceMs - Date.parse(`${date}T00:00:00Z`)) / msPerDay);
  });
  const recencyBasis = nonFallbackTraces.length;

  return {
    // Deliberately NOT tierOf(window.length) here, unlike every other Tiered
    // field below — the trend VALUE only becomes real computation once
    // window.length >= 5 (see above); at exactly 3-4 (TIER_PROVISIONAL_MIN's
    // own threshold), tierOf would report 'provisional' for what's still
    // just trend's untouched 'stable' initialization, not an observation.
    // basis stays the real window length either way — only the tier is
    // adjusted to match what's actually been computed. This same gap exists
    // verbatim in the vault's own M20 source; caught surfacing it as real
    // UI copy on Progress ("Energy trend: ..."), which the vault itself
    // never did (its own comment: capacityTrend has "no user-facing voice
    // yet").
    capacityTrend: { value: trend, basis: window.length, tier: window.length >= 5 ? tierOf(window.length) : 'insufficient' },
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
    recency: { value: recencyValue, basis: recencyBasis, tier: tierOf(recencyBasis) },
  };
}
