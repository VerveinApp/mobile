import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';
import { trimToNewestByDate } from '@/lib/rolling-window';

const KEY = 'vervein.sleepLog.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

/**
 * A manual, dated sleep-duration log — same shape and contract as
 * weight-log.ts, and deliberately separate from health-kit.ts's own
 * HealthKit-sourced sleep reading. That one already feeds the Plus-gated
 * readiness modifier (see check-in.tsx's effectiveHealthReadinessModifier)
 * automatically for anyone with a real wearable; this is the same signal
 * for anyone without one, entered by hand. Logging here is free — only the
 * full history depth is Plus-gated, same "raw log free, deeper view Plus"
 * split as everything else in Log.
 */
export type SleepLogEntry = {
  /** YYYY-MM-DD. */
  date: string;
  hours: number;
};

/** Records (or overwrites) one date's entry — one sleep entry per day, same
 * "safe to call more than once" contract as weight-log.ts's saveWeightEntry. */
export async function saveSleepEntry(date: string, hours: number) {
  const entries = await readJsonList<SleepLogEntry>(KEY);
  const withoutDate = entries.filter((e) => e.date !== date);
  const next = trimToNewestByDate([...withoutDate, { date, hours }], MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored entry, most recent first. */
export async function getSleepLog(): Promise<SleepLogEntry[]> {
  const entries = await readJsonList<SleepLogEntry>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteSleepEntry(date: string) {
  const entries = await readJsonList<SleepLogEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.date !== date));
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearSleepLog() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim saveSleepEntry always does. */
export async function restoreSleepLog(entries: SleepLogEntry[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
