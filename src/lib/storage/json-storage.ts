import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The read/parse/fallback half of the "one JSON value under one AsyncStorage
 * key" pattern nearly every store in this app (session history, weight log,
 * notes, condition log, exercise performance, ...) used to hand-roll
 * independently — a later full-app audit found the identical readAll/
 * JSON.parse/try-catch shape duplicated across more than a dozen files.
 * Generic over the VALUE shape, not just arrays — most callers store a
 * list (T[]), but exercise-performance.ts stores a Record<string, T[]>, and
 * this reads/writes either identically, since JSON.parse/stringify never
 * cared about the difference either. `fallback` is what a missing or
 * corrupt value reads as — an honest default, never a thrown error, the
 * same silent-failure contract every one of those call sites already had
 * before this existed. Each file keeps its own specific business logic
 * (sort order, dedup-by-date, trim window, merge rules) — this only
 * unifies the boilerplate underneath it, not the logic built on top.
 */
export async function readJsonValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Convenience wrapper for the common case (readJsonValue's fallback is
 * always an empty array) — nearly every call site is a list, not a Record. */
export async function readJsonList<T>(key: string): Promise<T[]> {
  return readJsonValue<T[]>(key, []);
}

/** The write half — same silent-failure contract (worst case a write
 * doesn't stick, never a crash) every call site already had. */
export async function writeJsonValue<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Worst case this write doesn't stick — never a crash.
  }
}

/** Wipes whatever's stored under a key — every "Delete My Data"/"Delete
 * Account" clear function in this app already does exactly this. */
export async function clearStoredValue(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort — same as never having written anything.
  }
}
