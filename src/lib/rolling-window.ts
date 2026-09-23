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

/**
 * How many daily entries the user-facing history stores keep —
 * session-history.ts and workout-log.ts. Deliberately separate from
 * ROLLING_WINDOW_DAYS above.
 *
 * BUG FIX: both stores used to be trimmed to ROLLING_WINDOW_DAYS (30
 * entries), so VerveIn Plus's "Progress & History", the consistency
 * calendar and Training Balance's "All" view silently lost everything
 * older than ~7 weeks for someone training four days a week. The adaptive
 * engine and the count-based coaching notes still read only the most recent
 * ROLLING_WINDOW_DAYS entries (see getRecentSessionHistory), so their
 * behavior is unchanged; only what's KEPT grew. Two years of daily entries
 * keeps each store's JSON well under a megabyte.
 */
export const HISTORY_RETENTION_ENTRIES = 730;

/** Oldest-first by date, then keep only the newest `max` — trims by the
 * DATE each entry is for, not the order it was written in. */
export function trimToNewestByDate<T extends { date: string }>(entries: T[], max: number): T[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-max);
}
