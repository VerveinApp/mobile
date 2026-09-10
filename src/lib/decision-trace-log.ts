import type { MinimalDecisionTrace } from '@/lib/engine/training-state';
import type { PolicyApplicationRecord } from '@/lib/engine/types';
import { ROLLING_WINDOW_DAYS } from '@/lib/rolling-window';
import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.decisionTraceLog.v1';
// BUG FIX (found in a later full-app audit): this used to be its own local
// `30`, matching session-history.ts's by convention/comment only — nothing
// enforced it. Single-sourced now; see rolling-window.ts's own doc comment.
// Still comfortably above LEDGER_WINDOW_N (14).
const MAX_ENTRIES = ROLLING_WINDOW_DAYS;

export type StoredTrace = MinimalDecisionTrace & {
  date: string;
  /** M9's governance bookkeeping, persisted so P1/P2/P3's interim status
   * has a real per-session audit trail — not read by M20's training-state
   * fold (that only needs gate1Exclusions/output), but this is the one
   * place a session's full trace is durably recorded, matching the vault's
   * own "surfacing, not hiding" reasoning for why M9 exists at all. */
  policyApplications: PolicyApplicationRecord[];
};

/**
 * The minimal per-session engine record M20 (training-state.ts) folds over
 * — what Gate 1 excluded and what actually got delivered, not the full
 * Decision Trace (M12), which was never ported. Recorded once, when a
 * session actually finishes (see check-in.tsx's handleFinishSession), not
 * on every plan-preview.ts call.
 */
export async function recordDecisionTrace(
  date: string,
  trace: {
    fallbackFired: boolean;
    gate1Exclusions: { exerciseId: string; excludedBy: string }[];
    deliveredExercises: { exerciseId: string; adapted_sets: number | null }[];
    policyApplications: PolicyApplicationRecord[];
  }
) {
  const entries = await readJsonList<StoredTrace>(KEY);
  const withoutToday = entries.filter((e) => e.date !== date);
  const stored: StoredTrace = {
    date,
    fallbackFired: trace.fallbackFired,
    gate1Exclusions: trace.gate1Exclusions,
    policyApplications: trace.policyApplications,
    output: {
      exercises: trace.deliveredExercises.map((e) => ({
        exerciseId: e.exerciseId,
        adapted_sets: e.adapted_sets ?? undefined,
      })),
    },
  };
  // Sorted by date before trimming, not insertion order — every write
  // today uses localDateStr() so the two currently always agree, but that
  // was an implicit assumption, not a guarantee (a future backfill/sync
  // write could violate it silently).
  const next = [...withoutToday, stored].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored trace, oldest first — matches compileTrainingState's expected ordering. */
export async function getDecisionTraceLog(): Promise<StoredTrace[]> {
  const entries = await readJsonList<StoredTrace>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim recordDecisionTrace always does.
 * Losing this on an uninstall silently resets Progress's Energy Trend and
 * Banked Volume cards back to "insufficient data" even though sessions
 * themselves (workout-log.ts) restored fine — this is the one store that
 * actually powers those two cards, so it's worth restoring on its own
 * merits, not just for completeness. */
export async function restoreDecisionTraceLog(entries: StoredTrace[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows
 * only. Same disclosed gap as workout-log.ts's clearWorkoutLog: this store
 * postdates handleDeleteData's original clear-list. */
export async function clearDecisionTraceLog() {
  await clearStoredValue(KEY);
}
