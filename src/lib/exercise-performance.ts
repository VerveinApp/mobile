import { localDateStr } from '@/lib/local-date';
import { clearStoredValue, readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const KEY = 'vervein.exercisePerformance.v1';
// Per-exercise cap, not a global one (workout-log.ts's own MAX_ENTRIES is
// global across all exercises) — a lift logged every session for months
// shouldn't crowd out a rarely-logged one's own history, and this many
// points is already more than a line chart needs to read as a real trend.
const MAX_HISTORY_PER_EXERCISE = 20;

/**
 * One logged weight+reps for a given exercise — keyed by exercise NAME, same
 * choice workout-log.ts's own WorkoutLogExercise already made (names aren't
 * guaranteed unique the way library ids are, but this is about "the exercise
 * a person recognizes," not the library's own bookkeeping). Only ever
 * written when someone actually logs a weight — this is opt-in, per-
 * exercise, entirely skippable; most sessions will touch none of this.
 */
export type ExercisePerformance = {
  weightKg: number;
  reps: number;
  /** Epley-estimated one-rep max — see recordPerformance's own doc
   * comment for why this, not raw weight, is what gets compared session
   * to session. */
  estimatedOneRepMax: number;
  date: string;
  /** Whether THIS record set a genuine personal best against this
   * exercise's own history — computed once, at write time, and persisted,
   * since it's a comparison against whatever history existed at the time,
   * not something re-derivable later without changing meaning once older
   * entries age out of the trimmed history. True on ANY of: a real
   * estimated-1RM jump (see LOAD_IMPROVEMENT_MIN_RATIO), the heaviest
   * weight ever lifted for this exercise, the most reps ever done at any
   * weight, or the best single-set volume (weight × reps) ever — a big
   * jump in reps at an unchanged weight, or a heavier single lift at fewer
   * reps than usual, is still a real best even when it doesn't move the
   * Epley estimate enough on its own to trip that one threshold. False (not
   * absent) when there was nothing to compare against yet (first time
   * logging this exercise) — an honest "no," not unknown. */
  improved: boolean;
};

// A real jump, not the noise of rounding a logged weight to the nearest
// plate/increment. Lives here (not momentum.ts) because it's a property of
// the comparison itself, persisted on the record — momentum.ts's
// getLoadImprovementNote just reads the result, it doesn't own the
// threshold.
const LOAD_IMPROVEMENT_MIN_RATIO = 1.02;

/**
 * MIGRATION: this store used to keep exactly one ExercisePerformance per
 * exercise (overwritten on every log), which is what let Progress show
 * "currently improving" but never a real trend line — there was no history
 * to chart. Storage is now a chronological (oldest-first) array per
 * exercise. Existing local data predates this change and is still shaped as
 * one bare object per exercise, not an array — read-time migration (wrap it
 * as a single-element array) rather than a one-time write-back migration, so
 * this can't race a concurrent read/write and never needs its own "have I
 * migrated yet" flag. Costs one Array.isArray check per exercise per read.
 */
type StoredShape = Record<string, ExercisePerformance | ExercisePerformance[]>;

async function readAll(): Promise<Record<string, ExercisePerformance[]>> {
  const parsed = await readJsonValue<StoredShape>(KEY, {});
  const migrated: Record<string, ExercisePerformance[]> = {};
  for (const [name, value] of Object.entries(parsed)) {
    migrated[name] = Array.isArray(value) ? value : [value];
  }
  return migrated;
}

async function writeAll(all: Record<string, ExercisePerformance[]>): Promise<void> {
  await writeJsonValue(KEY, all);
}

function latestOf(history: ExercisePerformance[] | undefined): ExercisePerformance | null {
  return history && history.length > 0 ? history[history.length - 1] : null;
}

export async function getLastPerformance(exerciseName: string): Promise<ExercisePerformance | null> {
  const all = await readAll();
  return latestOf(all[exerciseName]);
}

/**
 * Full chronological history (oldest first) for one exercise — the real
 * data behind Progress's Strength Progress line chart. Empty array (not
 * null) when nothing's ever been logged for this exercise, matching every
 * other list-returning getter in this app's own convention.
 */
export async function getPerformanceHistory(exerciseName: string): Promise<ExercisePerformance[]> {
  const all = await readAll();
  return all[exerciseName] ?? [];
}

/** data-backup.ts's export path only — the whole store, keyed by exercise
 * name, exactly as persisted (now history arrays, see the migration note
 * above for the shape this replaced). */
export async function getAllExercisePerformances(): Promise<Record<string, ExercisePerformance[]>> {
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
  await clearStoredValue(KEY);
}

/** Overwrites the whole store wholesale — data-backup.ts's restore path
 * only. Re-applies the same per-exercise MAX_HISTORY_PER_EXERCISE trim
 * recordPerformance always does, so a restored payload can't exceed this
 * store's normal size even if the exported backup somehow held more. */
export async function restoreExercisePerformance(all: Record<string, ExercisePerformance[]>): Promise<void> {
  const trimmed: Record<string, ExercisePerformance[]> = {};
  for (const [name, history] of Object.entries(all)) {
    trimmed[name] = history.slice(-MAX_HISTORY_PER_EXERCISE);
  }
  await writeAll(trimmed);
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
    .map(([exerciseName, history]) => ({ exerciseName, performance: latestOf(history) }))
    .filter((entry): entry is { exerciseName: string; performance: ExercisePerformance } => entry.performance?.improved === true)
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

// Mutates `all` in place and returns this one exercise's result — shared by
// recordPerformance and recordPerformanceBatch below so both compute a new
// record identically; only how many times readAll/writeAll happen around
// this differs between them.
function applyRecord(
  all: Record<string, ExercisePerformance[]>,
  exerciseName: string,
  weightKg: number,
  reps: number
): RecordPerformanceResult {
  const history = all[exerciseName] ?? [];
  const previous = latestOf(history);
  const estimatedOneRepMax = estimateOneRepMax(weightKg, reps);
  const oneRepMaxRatio = previous ? estimatedOneRepMax / previous.estimatedOneRepMax : 1;
  const oneRepMaxImproved = previous !== null && oneRepMaxRatio >= LOAD_IMPROVEMENT_MIN_RATIO;
  // Compared against the FULL history, not just `previous` — a real best
  // can beat every earlier session even when it doesn't beat the single
  // most recent one (e.g. a heavier single lately, a higher-rep set two
  // sessions back). Weight and volume need the same LOAD_IMPROVEMENT_MIN_RATIO
  // floor the 1RM check already applies — a 100kg->100.5kg "PR" is the exact
  // plate-rounding noise that threshold exists to filter, and this is a
  // second, independent way to trip past it if it stayed a bare `>`. Reps
  // has no equivalent noise problem (a whole rep someone actually completed
  // is never a rounding artifact), so any real increase counts.
  const isWeightPR = history.length > 0 && weightKg >= Math.max(...history.map((h) => h.weightKg)) * LOAD_IMPROVEMENT_MIN_RATIO;
  const isRepsPR = history.length > 0 && reps > Math.max(...history.map((h) => h.reps));
  const isVolumePR =
    history.length > 0 && weightKg * reps >= Math.max(...history.map((h) => h.weightKg * h.reps)) * LOAD_IMPROVEMENT_MIN_RATIO;
  const current: ExercisePerformance = {
    weightKg,
    reps,
    estimatedOneRepMax,
    date: localDateStr(),
    improved: oneRepMaxImproved || isWeightPR || isRepsPR || isVolumePR,
  };
  all[exerciseName] = [...history, current].slice(-MAX_HISTORY_PER_EXERCISE);
  return { previous, current, oneRepMaxRatio };
}

/**
 * Appends this session's weight+reps for an exercise and reports how it
 * compares to the last time this exercise was logged. `previous` is
 * whatever the most recent existing history entry was — comparison
 * semantics are unchanged from before this store kept history, only the
 * storage shape is different (append, trimmed to MAX_HISTORY_PER_EXERCISE,
 * instead of overwrite). `current.improved` is decided and persisted right
 * here, once — see that field's own doc comment for why it can't be
 * recomputed later.
 *
 * Single-exercise only — logging more than one exercise from the same
 * event (e.g. finishing a session) must use recordPerformanceBatch below,
 * not N parallel calls to this. Two concurrent readAll→mutate→writeAll
 * cycles against the same store both read the same snapshot and the
 * second write silently overwrites the first — this was a real bug (found
 * in a later full-app audit): logging weights for 2+ exercises in one
 * session finish via Promise.all here would lose every exercise but the
 * last-resolving one.
 */
export async function recordPerformance(
  exerciseName: string,
  weightKg: number,
  reps: number
): Promise<RecordPerformanceResult> {
  const all = await readAll();
  const result = applyRecord(all, exerciseName, weightKg, reps);
  await writeAll(all);
  return result;
}

/**
 * Same as recordPerformance, for every exercise logged in one event — a
 * single readAll/writeAll cycle around all of them, so this is the safe
 * way to record multiple exercises at once (see recordPerformance's own
 * doc comment for the lost-update race N parallel calls would cause).
 * check-in.tsx's finish-session handler is the one real caller.
 */
export async function recordPerformanceBatch(
  entries: { exerciseName: string; weightKg: number; reps: number }[]
): Promise<{ exerciseName: string; result: RecordPerformanceResult }[]> {
  const all = await readAll();
  const results = entries.map(({ exerciseName, weightKg, reps }) => ({
    exerciseName,
    result: applyRecord(all, exerciseName, weightKg, reps),
  }));
  await writeAll(all);
  return results;
}
