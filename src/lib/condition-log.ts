import type { Condition } from '@/lib/conditions';
import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.conditionLog.v1';
const MAX_ENTRIES = 200;

// A dated, recurring record of when a self-reported condition (from
// lib/conditions.ts's fixed list) flared up — deliberately more granular
// than that static list, which is collected once at onboarding and never
// updated. Same "collect only, never gate exercise selection" boundary as
// conditions.ts itself describes (an explicit Chief Architect Audit
// decision pending a real clinical-validation process): nothing here feeds
// engine/exercise-filtering.ts or constraint-resolution.ts, and it
// shouldn't until that validation exists. Held behind the same
// healthConsent bucket as body-measurements.ts — linked from Settings' DATA
// section and from Log, same as that file, ahead of a real privacy policy
// naming this data type (see this repo's own privacy-policy status).
export type ConditionLogEntry = {
  id: string;
  /** YYYY-MM-DD — the day it happened, which may be today or backfilled. */
  date: string;
  condition: Condition;
  note?: string;
  /** ISO 8601 — when the entry itself was recorded, distinct from `date`. */
  createdAt: string;
};

/** Appends one flare-up entry — unlike weight-log.ts/body-measurements.ts,
 * a single day can hold more than one entry (different conditions, or the
 * same one noted twice), so this never overwrites by date. `id` is the
 * caller's responsibility (expo-crypto's randomUUID, same as notes.ts's own
 * id generation) rather than generated in here — importing expo-crypto from
 * a lib/ module that data-backup.ts pulls in breaks under Jest (its native
 * module has no test-environment shim), so every module data-backup.ts
 * touches has to stay free of it. */
export async function addConditionLogEntry(id: string, date: string, condition: Condition, note?: string) {
  const entries = await readJsonList<ConditionLogEntry>(KEY);
  const trimmedNote = note?.trim();
  const entry: ConditionLogEntry = {
    id,
    date,
    condition,
    note: trimmedNote || undefined,
    createdAt: new Date().toISOString(),
  };
  const next = [...entries, entry].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored entry, most recent day first (createdAt as the tiebreaker
 * for same-day entries). */
export async function getConditionLog(): Promise<ConditionLogEntry[]> {
  const entries = await readJsonList<ConditionLogEntry>(KEY);
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export async function deleteConditionLogEntry(id: string) {
  const entries = await readJsonList<ConditionLogEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.id !== id));
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearConditionLog() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only. */
export async function restoreConditionLog(entries: ConditionLogEntry[]): Promise<void> {
  const trimmed = [...entries].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
