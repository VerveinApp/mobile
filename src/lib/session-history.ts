import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EnergyScore } from '@/components/home/energy-gauge';
import type { FeedbackResponse } from '@/lib/engine/types';

import { localDateStr } from './local-date';

const KEY = 'vervein.sessionHistory.v1';
const MAX_ENTRIES = 30; // a rolling month is plenty for a 7-day weekly view

export type SessionHistoryEntry = {
  /** YYYY-MM-DD. */
  date: string;
  completed: boolean;
  /** Optional free-text reflection captured after finishing a session — see home/check-in.tsx's done state. */
  notes?: string;
  /** The energy score checked in with that day — the real history M16's deload-pattern detection reads (see engine/deload-nudge.ts). Absent for entries logged before this field existed. */
  energy?: EnergyScore;
  /** The post-session feedback tapped, if any — M14-lite's record of what already fed into calibration.ts, so reopening a finished session doesn't re-ask. */
  feedback?: FeedbackResponse;
};

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function readAll(): Promise<SessionHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Records (or updates) today's completion state — safe to call more than once per day. `energy` is optional so callers that don't have it (none currently) don't need a fake value; check-in.tsx always has it by the time a session finishes. */
export async function recordSessionCompletion(completed: boolean, energy?: EnergyScore) {
  try {
    const date = localDateStr();
    const entries = await readAll();
    const withoutToday = entries.filter((e) => e.date !== date);
    const next = [...withoutToday, { date, completed, energy }].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case the weekly view just reads a little sparse — never a crash.
  }
}

export async function clearSessionHistory() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having a history.
  }
}

/** Removes a single logged entry by date — the per-row swipe-to-delete on Progress & History. */
export async function deleteSessionHistoryEntry(date: string) {
  try {
    const entries = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.date !== date)));
  } catch {
    // Worst case the entry reappears next load — never a crash.
  }
}

/** Every stored entry, most recent first — the real log behind Settings' Progress & History. */
export async function getSessionHistory(): Promise<SessionHistoryEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Attaches (or clears, if empty) a free-text note to a day's existing
 * entry — safe to call on every keystroke, same as recordSessionCompletion.
 * No-ops if that day has no entry yet, since a note can only be attached to
 * a session that was actually logged, never fabricated on its own.
 */
export async function saveSessionNote(date: string, notes: string) {
  try {
    const entries = await readAll();
    const trimmed = notes.trim();
    const next = entries.map((e) => (e.date === date ? { ...e, notes: trimmed || undefined } : e));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case the note doesn't stick — the session itself is still recorded either way.
  }
}

/** The note for a single day, if one was saved — prefills the field when reopening an already-finished session. */
export async function getSessionNote(date: string): Promise<string | undefined> {
  const entries = await readAll();
  return entries.find((e) => e.date === date)?.notes;
}

/** Records which post-session feedback button was tapped for a day — same no-op-if-no-entry-yet contract as saveSessionNote. The calibration update itself happens separately, in calibration.ts's submitSessionFeedback; this is just the "did I already ask today" record. */
export async function saveSessionFeedback(date: string, feedback: FeedbackResponse) {
  try {
    const entries = await readAll();
    const next = entries.map((e) => (e.date === date ? { ...e, feedback } : e));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case the feedback prompt reappears next load — never a crash, and calibration.ts's own write already landed independently.
  }
}

/** The feedback given for a single day, if any — lets check-in.tsx skip re-asking when reopening an already-finished session. */
export async function getSessionFeedback(date: string): Promise<FeedbackResponse | undefined> {
  const entries = await readAll();
  return entries.find((e) => e.date === date)?.feedback;
}

export type WeekDay = {
  weekday: string;
  /** null = in the future or no data yet; true/false = scheduled day's real outcome. */
  completed: boolean | null;
  isToday: boolean;
  isScheduled: boolean;
};

/**
 * This calendar week (Monday–Sunday) cross-referenced against the days the
 * user actually scheduled at onboarding — a day that was never scheduled
 * shows no dot at all rather than reading as a missed session.
 */
export async function getWeekActivity(scheduledDays: string[] | null): Promise<{
  days: WeekDay[];
  completedCount: number;
  scheduledCount: number;
}> {
  const entries = await readAll();
  const byDate = new Map(entries.map((e) => [e.date, e.completed]));

  const now = new Date();
  const todayIndex = now.getDay(); // 0=Sunday
  // Monday-start week: shift so Monday is index 0.
  const mondayOffset = (todayIndex + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = localDateStr(d);
    const weekday = WEEKDAY_NAMES[d.getDay()];
    const isScheduled = scheduledDays?.includes(weekday) ?? false;
    const todayStr = localDateStr(now);
    const isFuture = dateStr > todayStr;
    return {
      weekday,
      completed: isFuture ? null : (byDate.get(dateStr) ?? null),
      isToday: dateStr === todayStr,
      isScheduled,
    };
  });

  const scheduledCount = days.filter((d) => d.isScheduled).length;
  const completedCount = days.filter((d) => d.isScheduled && d.completed).length;

  return { days, completedCount, scheduledCount };
}

/**
 * Same shape as getWeekActivity but for the last `weekCount` calendar weeks
 * (oldest first, current week last) — the data behind Progress's consistency
 * grid. Every cell is still cross-referenced against scheduledDays, so an
 * unscheduled day reads as "no dot," not a missed session.
 */
export async function getRecentWeeks(scheduledDays: string[] | null, weekCount = 4): Promise<WeekDay[][]> {
  const entries = await readAll();
  const byDate = new Map(entries.map((e) => [e.date, e.completed]));

  const now = new Date();
  const todayIndex = now.getDay();
  const mondayOffset = (todayIndex + 6) % 7;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - mondayOffset);
  const todayStr = localDateStr(now);

  const weeks: WeekDay[][] = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - w * 7);
    const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = localDateStr(d);
      const weekday = WEEKDAY_NAMES[d.getDay()];
      const isScheduled = scheduledDays?.includes(weekday) ?? false;
      const isFuture = dateStr > todayStr;
      return {
        weekday,
        completed: isFuture ? null : (byDate.get(dateStr) ?? null),
        isToday: dateStr === todayStr,
        isScheduled,
      };
    });
    weeks.push(days);
  }
  return weeks;
}

/**
 * Consecutive scheduled days completed, walking back from today. A
 * scheduled day still in progress today doesn't break the streak — only a
 * scheduled day that's already passed and wasn't completed does. Real
 * count, not a fabricated number: a brand-new account genuinely starts at 0.
 */
export async function getCurrentStreak(scheduledDays: string[] | null): Promise<number> {
  if (!scheduledDays || scheduledDays.length === 0) return 0;

  const entries = await readAll();
  const byDate = new Map(entries.map((e) => [e.date, e.completed]));
  const todayStr = localDateStr();

  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < MAX_ENTRIES; i++) {
    const dateStr = localDateStr(cursor);
    const weekday = WEEKDAY_NAMES[cursor.getDay()];
    if (scheduledDays.includes(weekday)) {
      const completed = byDate.get(dateStr);
      if (completed === true) {
        streak++;
      } else if (dateStr !== todayStr) {
        break;
      }
      // else: today, still in progress — doesn't count yet, doesn't break either.
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
