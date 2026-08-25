import AsyncStorage from '@react-native-async-storage/async-storage';

import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { MovementPattern } from '@/lib/engine/types';
import { localDateStr } from '@/lib/local-date';
import type { BodyArea } from '@/lib/plan-preview';

const KEY = 'vervein.workoutLog.v1';
const MAX_ENTRIES = 30; // matches session-history.ts's rolling window

/**
 * Per-exercise completion for a finished session — session-history.ts only
 * ever recorded a single completed/missed boolean for the whole day, which
 * can't tell "did everything" apart from "did half of it and stopped." This
 * is the real, honest granularity: exactly which exercises the user actually
 * checked off, each carrying its own body area so a real breakdown (see
 * getBodyAreaBreakdown) can be computed from what was actually done, not a
 * fabricated estimate.
 */
export type WorkoutLogExercise = {
  name: string;
  bodyArea: BodyArea;
  completed: boolean;
};

export type WorkoutLogEntry = {
  /** YYYY-MM-DD. */
  date: string;
  exercises: WorkoutLogExercise[];
  /** true only for entries written by saveRetroactiveWorkoutLog (Progress &
   * History's "Log a Past Session" flow) — see that function's own doc
   * comment for why this is kept separate from saveWorkoutLog's live path.
   * Absent (not false) for every other entry, so this stays an honest "was
   * this backfilled," never a guess for entries logged before the flag
   * existed. */
  retroactive?: boolean;
};

export type CompletionStatus = 'done' | 'partial' | 'skipped';

/**
 * Derives the one signal the product's whole thesis rides on — did the
 * user follow the (deliberately trimmed) plan, do some of it, or none —
 * from the real per-exercise completion data above, rather than the flat
 * completed/missed boolean session-history.ts used to be limited to. An
 * empty exercise list (no entry yet, or a plan that resolved to zero
 * exercises) reads the same as zero completed: 'skipped', never a
 * fabricated in-between state.
 */
export function getCompletionStatus(exercises: WorkoutLogExercise[]): CompletionStatus {
  if (exercises.length === 0) return 'skipped';
  const completedCount = exercises.filter((e) => e.completed).length;
  if (completedCount === 0) return 'skipped';
  if (completedCount === exercises.length) return 'done';
  return 'partial';
}

async function readAll(): Promise<WorkoutLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkoutLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Records (or updates) today's exercise-level completion — safe to call more than once per day. */
export async function saveWorkoutLog(date: string, exercises: WorkoutLogExercise[]) {
  try {
    const entries = await readAll();
    const withoutToday = entries.filter((e) => e.date !== date);
    const next = [...withoutToday, { date, exercises }].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case the exercise-level detail just doesn't stick — the
    // session-level completed/missed record in session-history.ts still does.
  }
}

/**
 * Same real semantics as saveWorkoutLog, but for a past date the user is
 * backfilling from memory — Progress & History's "Log a Past Session" flow.
 * Kept as a separate function (not an optional param on saveWorkoutLog) so
 * check-in.tsx's live path can never accidentally mark a real, in-the-moment
 * log as retroactive. Exercises here are deliberately body-area-level, not
 * real library exercise IDs (see the log-past-session sheet's own comment
 * on why) — getMovementPatternBreakdown already has an existing, honest
 * degrade for a name that doesn't resolve in the library (silently skipped,
 * per its own doc comment), so this doesn't need any new handling there.
 */
export async function saveRetroactiveWorkoutLog(date: string, exercises: WorkoutLogExercise[]) {
  try {
    const entries = await readAll();
    const withoutDate = entries.filter((e) => e.date !== date);
    const next = [...withoutDate, { date, exercises, retroactive: true }].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case the exercise-level detail just doesn't stick — the
    // session-level completed/missed record in session-history.ts still does.
  }
}

export async function getWorkoutLog(date: string): Promise<WorkoutLogEntry | null> {
  const entries = await readAll();
  return entries.find((e) => e.date === date) ?? null;
}

/** Every stored entry, most recent first — same shape as session-history.ts's getSessionHistory, for screens showing the full log rather than a single date. */
export async function getAllWorkoutLogs(): Promise<WorkoutLogEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteWorkoutLog(date: string) {
  try {
    const entries = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.date !== date)));
  } catch {
    // Worst case the entry reappears next load — never a crash.
  }
}

/** Wipes the whole log — Settings' "Delete My Data"/"Delete Account" flows
 * only. This store didn't exist yet when handleDeleteData was first
 * written, and nothing added it to that clear-list afterward — a real gap
 * (per-exercise history survived a supposed full wipe), not a design choice. */
export async function clearWorkoutLog() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having logged anything.
  }
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim saveWorkoutLog always does. */
export async function restoreWorkoutLog(entries: WorkoutLogEntry[]): Promise<void> {
  try {
    const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Worst case this one field doesn't restore — the rest of the backup still applies independently.
  }
}

/**
 * Real distinct session count — days with at least one ACTUALLY completed
 * exercise, not just a dated entry. That distinction matters: handleStartSession
 * in check-in.tsx writes a workout-log entry the instant "Start Session" is
 * tapped, with every exercise still `completed: false` (the honest starting
 * point) — a day opened and then abandoned before finishing a single
 * exercise would otherwise still count as "a session," diluting the "enough
 * real history to draw a shape" gate progress.tsx's radar needs below its
 * intended meaning. Separate from getBodyAreaBreakdown's per-area totals.
 * With EXERCISES_PER_FOCUS_AREA at 2, a single completed session can already
 * max an area's own running total under getBodyAreaBreakdown's
 * self-normalized scaling (2 completed / 2 = 100%), so gating the radar on
 * area-spread alone (bodyAreaBreakdown having 2+ areas with data) isn't
 * enough on its own to stop one day's plan composition from looking like an
 * "achieved" shape — see progress.tsx's own hasMovementData for where this
 * is actually combined with that check. Same `sinceDays` rolling-window
 * contract as getBodyAreaBreakdown.
 */
export async function getLoggedSessionCount(sinceDays?: number): Promise<number> {
  const entries = await readAll();
  const cutoff = sinceDays !== undefined ? sinceDateStr(sinceDays) : null;
  return entries.filter((e) => (cutoff === null || e.date >= cutoff) && e.exercises.some((ex) => ex.completed)).length;
}

export type BodyAreaBreakdown = Record<BodyArea, { completed: number; total: number }>;

const EMPTY_BREAKDOWN: BodyAreaBreakdown = {
  upper: { completed: 0, total: 0 },
  lower: { completed: 0, total: 0 },
  core: { completed: 0, total: 0 },
  full: { completed: 0, total: 0 },
};

/**
 * A trailing N-day cutoff (inclusive of today), never a calendar-boundary
 * reset — see progress.tsx's Training Balance section for why a hard
 * "resets every Monday" window was rejected: it would make the radar
 * collapse to near-empty every reset even right after a strong session,
 * fighting this whole feature's own "never reads as you didn't do enough"
 * design. `days` still can't see further back than MAX_ENTRIES worth of
 * storage regardless of its value — this only ever narrows what's already
 * stored, never extends it.
 */
function sinceDateStr(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return localDateStr(cutoff);
}

/**
 * Tallies every logged exercise (not just completed ones — an area with a
 * lot of skipped work is real signal too) into per-body-area completed/
 * total counts. Real numbers from what was actually logged, not a
 * projection. `sinceDays` omitted (or undefined) means every stored entry —
 * see sinceDateStr's own note on why a narrower window is a rolling
 * trailing cutoff, never a calendar reset.
 */
export async function getBodyAreaBreakdown(sinceDays?: number): Promise<BodyAreaBreakdown> {
  const entries = await readAll();
  const cutoff = sinceDays !== undefined ? sinceDateStr(sinceDays) : null;
  const breakdown: BodyAreaBreakdown = {
    upper: { ...EMPTY_BREAKDOWN.upper },
    lower: { ...EMPTY_BREAKDOWN.lower },
    core: { ...EMPTY_BREAKDOWN.core },
    full: { ...EMPTY_BREAKDOWN.full },
  };
  for (const entry of entries) {
    if (cutoff !== null && entry.date < cutoff) continue;
    for (const exercise of entry.exercises) {
      breakdown[exercise.bodyArea].total += 1;
      if (exercise.completed) breakdown[exercise.bodyArea].completed += 1;
    }
  }
  return breakdown;
}

export type MovementPatternBreakdown = Partial<Record<MovementPattern, { completed: number; total: number }>>;

/**
 * Same real-data tally as getBodyAreaBreakdown, one level more granular —
 * per logged exercise, resolves its real movement_patterns via the library
 * (workout-log.ts only stores name/bodyArea/completed, not patterns, so
 * this is a join at read time, not a schema change). An exercise with
 * multiple patterns (e.g. a squat-to-press) counts toward each one — it
 * genuinely trained both qualities, so double-counting here is correct, not
 * a bug. Exercises whose name no longer resolves in the library (unlikely,
 * but the library is not literally immutable across app updates) are
 * silently skipped rather than guessed at. Partial, not a full Record,
 * because a pattern nothing was ever logged against shouldn't render as a
 * zero row — see progress.tsx's own "only show what's real" filtering.
 * Same `sinceDays` rolling-window contract as getBodyAreaBreakdown.
 */
export async function getMovementPatternBreakdown(sinceDays?: number): Promise<MovementPatternBreakdown> {
  const entries = await readAll();
  const cutoff = sinceDays !== undefined ? sinceDateStr(sinceDays) : null;
  const breakdown: MovementPatternBreakdown = {};
  for (const entry of entries) {
    if (cutoff !== null && entry.date < cutoff) continue;
    for (const exercise of entry.exercises) {
      const libraryExercise = exerciseLibrary.getByName(exercise.name);
      if (!libraryExercise) continue;
      for (const pattern of libraryExercise.movement_patterns) {
        const current = breakdown[pattern] ?? { completed: 0, total: 0 };
        current.total += 1;
        if (exercise.completed) current.completed += 1;
        breakdown[pattern] = current;
      }
    }
  }
  return breakdown;
}
