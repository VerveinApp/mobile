/**
 * Shared "how many days back" cap for the app's per-day rolling-history
 * stores — session-history.ts, workout-log.ts, and decision-trace-log.ts.
 * Single-sourced after a later full-app audit found all three
 * independently hardcoding the same value (30), each with a comment
 * admitting it has to match the others, but nothing actually enforcing
 * that: a future change to one file's own local constant would have
 * silently drifted from the rest.
 *
 * A rolling month comfortably covers every real read pattern across the
 * three: session-history.ts's own 7-day weekly view, workout-log.ts's
 * training-day lookups, and decision-trace-log.ts's LEDGER_WINDOW_N (14)
 * full-decision trace.
 */
export const ROLLING_WINDOW_DAYS = 30;
