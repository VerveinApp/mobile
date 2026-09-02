import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateStr } from '@/lib/local-date';

const KEY = 'vervein.exercisePerformance.v1';

/**
 * The last logged weight+reps for a given exercise — keyed by exercise
 * NAME, same choice workout-log.ts's own WorkoutLogExercise already made
 * (names aren't guaranteed unique the way library ids are, but this is
 * about "the exercise a person recognizes," not the library's own
 * bookkeeping). Only ever written when someone actually logs a weight —
 * this is opt-in, per-exercise, entirely skippable; most sessions will
 * touch none of this.
 */
export type ExercisePerformance = {
  weightKg: number;
  reps: number;
  /** Epley-estimated one-rep max — see recordPerformance's own doc
   * comment for why this, not raw weight, is what gets compared session
   * to session. */
  estimatedOneRepMax: number;
  date: string;
  /** Whether THIS record was a real improvement over whatever came before
   * it — computed once, at write time, and persisted, because by the time
   * anything reads this back (Progress's own "getting stronger" list),
   * there's no "previous" left to compare against; each new log overwrites
   * the last. False (not absent) when there was nothing to compare against
   * yet (first time logging this exercise) — an honest "no," not unknown. */
  improved: boolean;
};

// A real jump, not the noise of rounding a logged weight to the nearest
// plate/increment. Lives here (not momentum.ts) because it's a property of
// the comparison itself, persisted on the record — momentum.ts's
// getLoadImprovementNote just reads the result, it doesn't own the
// threshold.
const LOAD_IMPROVEMENT_MIN_RATIO = 1.02;

async function readAll(): Promise<Record<string, ExercisePerformance>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ExercisePerformance>) : {};
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, ExercisePerformance>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Worst case this exercise's progress note just doesn't fire next
    // time — not a crash, and nothing else in the app depends on this
    // write succeeding.
  }
}

export async function getLastPerformance(exerciseName: string): Promise<ExercisePerformance | null> {
  const all = await readAll();
  return all[exerciseName] ?? null;
}

/** data-backup.ts's export path only — the whole store, keyed by exercise
 * name, exactly as persisted. */
export async function getAllExercisePerformances(): Promise<Record<string, ExercisePerformance>> {
  return readAll();
}

/**
 * BUG FIX: this store (Progress tab's "Strength Progress" section) postdated
 * data-backup.ts's clear-list — the same disclosed gap that file's own
 * header comment already warns about for workout-log.ts/weight-log.ts/
 * decision-trace-log.ts. Settings' "Delete My Data"/"Delete Account" flows
 * promise a full, unrecoverable wipe; without this, logged 1RMs silently
 * survived that promise and kept rendering in Progress afterward.
 */
export async function clearExercisePerformance(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having logged anything.
  }
}

/** Overwrites the whole store wholesale — data-backup.ts's restore path only. */
export async function restoreExercisePerformance(all: Record<string, ExercisePerformance>): Promise<void> {
  await writeAll(all);
}

/**
 * Every exercise whose most recently logged record was a real improvement
 * — Progress's "getting stronger" list reads this directly rather than
 * recomputing anything, since the improvement was already decided (and
 * persisted) at the moment it was logged. Sorted by name for a stable,
 * predictable list rather than insertion order (a Record's own key order
 * isn't something to rely on for display).
 */
export async function getImprovedExercises(): Promise<{ exerciseName: string; performance: ExercisePerformance }[]> {
  const all = await readAll();
  return Object.entries(all)
    .filter(([, performance]) => performance.improved)
    .map(([exerciseName, performance]) => ({ exerciseName, performance }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

function estimateOneRepMax(weightKg: number, reps: number): number {
  // Epley formula — the same one Fitbod-style lifting apps use to compare
  // strength across sessions where weight and reps both vary, rather than
  // raw weight alone (which would wrongly credit "heavier weight, way
  // fewer reps" as unambiguous progress when it might really be less total
  // work).
  return weightKg * (1 + reps / 30);
}

export type RecordPerformanceResult = {
  previous: ExercisePerformance | null;
  current: ExercisePerformance;
  oneRepMaxRatio: number;
};

/**
 * Saves this session's weight+reps for an exercise and reports how it
 * compares to the last time this exercise was logged. Always overwrites
 * the stored "last" performance with the current one (even when it's not
 * an improvement) — this tracks "most recent," not "personal best," so a
 * genuinely lighter session afterward compares against what actually just
 * happened, not an old peak. `current.improved` is decided and persisted
 * right here, once — see that field's own doc comment for why it can't be
 * recomputed later.
 */
export async function recordPerformance(
  exerciseName: string,
  weightKg: number,
  reps: number
): Promise<RecordPerformanceResult> {
  const all = await readAll();
  const previous = all[exerciseName] ?? null;
  const estimatedOneRepMax = estimateOneRepMax(weightKg, reps);
  const oneRepMaxRatio = previous ? estimatedOneRepMax / previous.estimatedOneRepMax : 1;
  const current: ExercisePerformance = {
    weightKg,
    reps,
    estimatedOneRepMax,
    date: localDateStr(),
    improved: previous !== null && oneRepMaxRatio >= LOAD_IMPROVEMENT_MIN_RATIO,
  };
  all[exerciseName] = current;
  await writeAll(all);
  return { previous, current, oneRepMaxRatio };
}
