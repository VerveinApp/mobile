// Policy parameters — ported verbatim from the adaptive-engine research
// vault's src/reference/policy-parameters.ts. Founder-settable values that
// are POLICY, not architecture. Per the Founder Decision on baseline session
// composition (2026-07-22, Decision Log): "Baseline Plan selects N exercises
// per focus area, where N is a configurable policy parameter, not a
// hardcoded architectural constant." Changing a value here is a policy
// change (Decision Log entry), not an engine redesign.

/** Exercises selected per focus area at baseline generation. Currently 2 by policy. */
export const EXERCISES_PER_FOCUS_AREA = 2;

// --- Training State Compiler parameters (FE-13 graduation, 2026-07-22) ---
// Interim values, founder-adjustable pending tuning against real data —
// flagged as policy in the graduation Decision Log entry, never architecture.
// Consumed by engine/training-state.ts (M20), wired in via lib/training-state.ts
// and surfaced on Progress's "Training Load" section.

/** Evidence tiers: observations needed before a derived value is "provisional" / "established". Extends the calibration dampener's existing n=5 precedent. */
export const TIER_PROVISIONAL_MIN = 3;
export const TIER_ESTABLISHED_MIN = 10;

/** Capacity Trend: |mean(last 3 energy) − mean(prior 4)| must exceed this to leave "stable". */
export const TREND_DELTA = 0.5;

/** Rolling window length in check-ins (the 7-day window FE-12/Energy Score describe). */
export const ROLLING_WINDOW_N = 7;

/** Decision Memory: how many recent runs the compiler summarizes. */
export const DECISION_MEMORY_N = 7;

// --- Muscle Stimulus Ledger parameters (FE-28 graduation, 2026-07-22) ---

/** Stimulus Ledger: how many recent non-fallback runs the compiler folds into
 *  delivered-dose-by-body-area. Matches ROLLING_WINDOW_N/DECISION_MEMORY_N's
 *  own count-based windowing (trailing N runs, not calendar days — traces
 *  carry no date of their own; count-based windowing is this module's
 *  existing, established convention, not a new one introduced here).
 *  Interim value, founder-adjustable pending tuning against real data —
 *  flagged as policy in the graduation Decision Log entry, never architecture. */
export const LEDGER_WINDOW_N = 14;

// --- Stimulus Debt (FE-18 graduation, 2026-07-24) ---
// Deliberately reuses LEDGER_WINDOW_N rather than introducing a second,
// independently-tunable window constant. Ledger and Debt are two readings of
// the identical trailing-session window (delivered vs. shortfall).
