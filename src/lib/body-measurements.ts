import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.bodyMeasurements.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

// Held behind the same healthConsent bucket as sex/height/weight/conditions
// in user-profile.ts (see onboarding/step-5.tsx's consent copy — "share
// this to tailor my training load" already covers "more numbers about your
// body," not just the ones collected at onboarding). NOT yet wired into any
// nav row (Log or Settings) — deliberately built ahead of time but kept
// unreachable until the app's real privacy policy (currently a placeholder,
// see legal/privacy.tsx) actually names this data type. Flip it on by
// adding a LogRow/NavRow pointing at settings/body-measurements.tsx once
// that's ready — nothing else here needs to change.
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

async function readAll(): Promise<BodyMeasurementEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BodyMeasurementEntry[]) : [];
  } catch {
    return [];
  }
}

/** Merges the given fields into that date's entry (creating one if it
 * doesn't exist yet) — unlike weight-log.ts's single-field overwrite, a
 * day here can accumulate measurements logged at different times, e.g.
 * waist this morning and chest later, without one call erasing the other. */
export async function saveBodyMeasurementEntry(date: string, fields: Partial<Record<BodyMeasurementField, number>>) {
  try {
    const entries = await readAll();
    const existing = entries.find((e) => e.date === date);
    const withoutDate = entries.filter((e) => e.date !== date);
    const next = [...withoutDate, { ...existing, ...fields, date }].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case this entry doesn't stick — never a crash.
  }
}

/** Every stored entry, most recent first. */
export async function getBodyMeasurements(): Promise<BodyMeasurementEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteBodyMeasurementEntry(date: string) {
  try {
    const entries = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.date !== date)));
  } catch {
    // Worst case the entry reappears next load — never a crash.
  }
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows only. */
export async function clearBodyMeasurements() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having logged anything.
  }
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only. */
export async function restoreBodyMeasurements(entries: BodyMeasurementEntry[]): Promise<void> {
  try {
    const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Worst case this one field doesn't restore — the rest of the backup still applies independently.
  }
}
