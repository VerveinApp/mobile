import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vervein.weightLog.v1';
const MAX_ENTRIES = 365; // roughly a year of daily entries — generous, not unbounded

export type WeightLogEntry = {
  /** YYYY-MM-DD. */
  date: string;
  weightKg: number;
};

async function readAll(): Promise<WeightLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WeightLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Records (or overwrites) one date's entry — one weigh-in per day, same
 * "safe to call more than once" contract as workout-log.ts's saveWorkoutLog. */
export async function saveWeightEntry(date: string, weightKg: number) {
  try {
    const entries = await readAll();
    const withoutDate = entries.filter((e) => e.date !== date);
    const next = [...withoutDate, { date, weightKg }].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case this entry doesn't stick — never a crash.
  }
}

/** Every stored entry, most recent first. */
export async function getWeightLog(): Promise<WeightLogEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteWeightEntry(date: string) {
  try {
    const entries = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.date !== date)));
  } catch {
    // Worst case the entry reappears next load — never a crash.
  }
}
