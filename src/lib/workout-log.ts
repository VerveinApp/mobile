import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

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

export type BodyAreaBreakdown = Record<BodyArea, { completed: number; total: number }>;

const EMPTY_BREAKDOWN: BodyAreaBreakdown = {
  upper: { completed: 0, total: 0 },
  lower: { completed: 0, total: 0 },
  core: { completed: 0, total: 0 },
  full: { completed: 0, total: 0 },
};

/**
 * Tallies every logged exercise (not just completed ones — an area with a
 * lot of skipped work is real signal too) across all stored entries into
 * per-body-area completed/total counts. Real numbers from what was actually
 * logged, not a projection.
 */
export async function getBodyAreaBreakdown(): Promise<BodyAreaBreakdown> {
  const entries = await readAll();
  const breakdown: BodyAreaBreakdown = {
    upper: { ...EMPTY_BREAKDOWN.upper },
    lower: { ...EMPTY_BREAKDOWN.lower },
    core: { ...EMPTY_BREAKDOWN.core },
    full: { ...EMPTY_BREAKDOWN.full },
  };
  for (const entry of entries) {
    for (const exercise of entry.exercises) {
      breakdown[exercise.bodyArea].total += 1;
      if (exercise.completed) breakdown[exercise.bodyArea].completed += 1;
    }
  }
  return breakdown;
}
