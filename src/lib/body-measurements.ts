import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.bodyMeasurements.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

// Held behind the same healthConsent bucket as sex/height/weight/conditions
// in user-profile.ts (see onboarding/step-5.tsx's consent copy — "share
// this to tailor my training load" already covers "more numbers about your
// body," not just the ones collected at onboarding). Linked from Settings'
// DATA section and from Log, ahead of the app's real privacy policy
// (currently a placeholder, see legal/privacy.tsx) actually naming this
// data type — same accepted tradeoff as condition-log.ts.
export type BodyMeasurementEntry = {
  /** YYYY-MM-DD. */
  date: string;
  waistCm?: number;
  chestCm?: number;
  hipCm?: number;
  armCm?: number;
  thighCm?: number;
};

export type BodyMeasurementField = Exclude<keyof BodyMeasurementEntry, 'date'>;

/** Merges the given fields into that date's entry (creating one if it
 * doesn't exist yet) — unlike weight-log.ts's single-field overwrite, a
 * day here can accumulate measurements logged at different times, e.g.
 * waist this morning and chest later, without one call erasing the other. */
export async function saveBodyMeasurementEntry(date: string, fields: Partial<Record<BodyMeasurementField, number>>) {
  const entries = await readJsonList<BodyMeasurementEntry>(KEY);
  const existing = entries.find((e) => e.date === date);
  const withoutDate = entries.filter((e) => e.date !== date);
  const next = [...withoutDate, { ...existing, ...fields, date }].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/** Every stored entry, most recent first. */
export async function getBodyMeasurements(): Promise<BodyMeasurementEntry[]> {
  const entries = await readJsonList<BodyMeasurementEntry>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteBodyMeasurementEntry(date: string) {
  const entries = await readJsonList<BodyMeasurementEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.date !== date));
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearBodyMeasurements() {
  await clearStoredValue(KEY);
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only. */
export async function restoreBodyMeasurements(entries: BodyMeasurementEntry[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}
