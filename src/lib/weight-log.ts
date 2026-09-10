import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.weightLog.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

export type WeightLogEntry = {
  /** YYYY-MM-DD. */
  date: string;
  weightKg: number;
};

/** Records (or overwrites) one date's entry — one weigh-in per day, same
 * "safe to call more than once" contract as workout-log.ts's saveWorkoutLog. */
export async function saveWeightEntry(date: string, weightKg: number) {
  const entries = await readJsonList<WeightLogEntry>(KEY);
  const withoutDate = entries.filter((e) => e.date !== date);
  const next = [...withoutDate, { date, weightKg }].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored entry, most recent first. */
export async function getWeightLog(): Promise<WeightLogEntry[]> {
  const entries = await readJsonList<WeightLogEntry>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * The real "current weight" — the latest logged entry if one exists, else
 * the standing profile value. Centralized here after a later full-app audit
 * found profile.tsx and goals-sheet.tsx each resolving this differently
 * (one preferred the weight log, the other read profile.weightKg directly)
 * — updating weight via Biometrics without also logging a new weight-log
 * entry could make the two screens show two different numbers for the same
 * metric, a tap apart. Pure (no I/O of its own) so it composes into
 * whichever Promise.all a caller already has going — pass in whatever
 * getWeightLog()/getProfile() already returned.
 */
export function resolveCurrentWeightKg(weightLog: WeightLogEntry[], profileWeightKg: string | undefined): number | null {
  return weightLog[0]?.weightKg ?? (profileWeightKg ? Number(profileWeightKg) : null);
}

export async function deleteWeightEntry(date: string) {
  const entries = await readJsonList<WeightLogEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.date !== date));
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows
 * only. Same disclosed gap as workout-log.ts's clearWorkoutLog: this store
 * postdates handleDeleteData's original clear-list. */
export async function clearWeightLog() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim saveWeightEntry always does. */
export async function restoreWeightLog(entries: WeightLogEntry[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
