import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.nutritionLog.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

/**
 * A manual, dated calorie-intake log — same shape and contract as
 * weight-log.ts. Deliberately distinct from calorie-estimate.ts, which
 * estimates calories BURNED during a workout from MET values — this is
 * calories CONSUMED, a completely different number entered by hand, not
 * computed. Logging here is free — only the full history depth is
 * Plus-gated, same "raw log free, deeper view Plus" split as everything
 * else in Log. A single daily total, not a full macro tracker — that's a
 * meaningfully bigger feature this doesn't attempt.
 */
export type NutritionLogEntry = {
  /** YYYY-MM-DD. */
  date: string;
  calories: number;
};

/** Records (or overwrites) one date's entry — one total per day, same
 * "safe to call more than once" contract as weight-log.ts's saveWeightEntry. */
export async function saveNutritionEntry(date: string, calories: number) {
  const entries = await readJsonList<NutritionLogEntry>(KEY);
  const withoutDate = entries.filter((e) => e.date !== date);
  const next = [...withoutDate, { date, calories }].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored entry, most recent first. */
export async function getNutritionLog(): Promise<NutritionLogEntry[]> {
  const entries = await readJsonList<NutritionLogEntry>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteNutritionEntry(date: string) {
  const entries = await readJsonList<NutritionLogEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.date !== date));
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearNutritionLog() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim saveNutritionEntry always does. */
export async function restoreNutritionLog(entries: NutritionLogEntry[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
