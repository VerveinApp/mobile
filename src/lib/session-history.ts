import type { EnergyScore } from '@/components/home/energy-gauge';
import type { FeedbackResponse } from '@/lib/engine/types';
import { getAccountStartDate } from '@/lib/onboarding-draft';
import { WEEKDAY_NAMES } from '@/lib/profile-labels';
import { ROLLING_WINDOW_DAYS } from '@/lib/rolling-window';
import { clearStoredValue, readJsonList, writeJsonValue } from '@/lib/storage/json-storage';
import type { CompletionStatus } from '@/lib/workout-log';

import { localDateStr } from './local-date';

const KEY = 'vervein.sessionHistory.v1';
// See rolling-window.ts's own doc comment for why this is shared, not a
// local constant — a rolling month is plenty for this store's own 7-day
// weekly view.
const MAX_ENTRIES = ROLLING_WINDOW_DAYS;

export type SessionHistoryEntry = {
  /** YYYY-MM-DD. */
  date: string;
  /** true for both 'done' and 'partial' completionStatus — some real effort
   * happened. Kept as the weekly-dot view's existing boolean contract;
   * completionStatus below is the real done/partial/skipped granularity. */
  completed: boolean;
  /** Optional free-text reflection captured after finishing a session — see home/check-in.tsx's done state. */
  notes?: string;
  /** The energy score checked in with that day — the real history M16's deload-pattern detection reads (see engine/deload-nudge.ts). Absent for entries logged before this field existed. */
  energy?: EnergyScore;
  /** Self-reported soreness for a backfilled day, 1 (none) to 5 (very sore) — same scale shape as energy but inverted meaning (higher = worse). Only ever set by recordPastSessionCompletion's optional param; nothing downstream reads it yet, same personal-record-only status as the note field. */
  soreness?: EnergyScore;
  /** The post-session feedback tapped, if any — M14-lite's record of what already fed into calibration.ts, so reopening a finished session doesn't re-ask. */
  feedback?: FeedbackResponse;
  /** Did they do all / some / none of the workout — the real per-exercise
   * signal from workout-log.ts's getCompletionStatus, not just the flat
   * `completed` boolean above. Absent for entries logged before this field
   * existed (never backfilled/guessed). */
  completionStatus?: CompletionStatus;
  /** true only for entries written by recordPastSessionCompletion (Progress
   * & History's "Log a Past Session" flow) — a day that already happened
   * and was reconstructed from memory afterward, never run through the live
   * engine. Absent (not false) for every entry recordSessionCompletion
   * itself writes, so this stays an honest "was this backfilled," not a
   * guess for old entries logged before the flag existed. */
  loggedRetroactively?: boolean;
  /** Local hour (0–23) recordSessionCompletion was first called for this
   * date — i.e. when a real, live check-in actually started, not when it
   * finished (which could be 30–90+ minutes later depending on session
   * length, a much noisier signal for "when does this person show up").
   * Never set by recordPastSessionCompletion — a backfilled day reflects
   * whenever it was reconstructed from memory, not a real arrival time, so
   * it stays absent rather than recording a misleading hour. Read by
   * session-reminders.ts to personalize reminder timing once enough real
   * samples exist; absent for entries logged before this field existed. */
  checkedInAtHour?: number;
  /** calorie-estimate.ts's real per-session estimate, persisted so
   * getWeeklyCaloriesBurned below can sum across days without re-deriving it
   * from workout-log.ts's exercises (which don't carry the bodyweight this
   * needs, and may since have been trimmed). Absent whenever check-in.tsx
   * itself had no honest estimate to give (no weightKg on the profile) — see
   * estimateCaloriesBurned's own doc comment — and for entries logged before
   * this field existed. Never set for a skipped session. */
  caloriesBurned?: number;
};

/** Records (or updates) today's completion state — safe to call more than once per day (check-in.tsx calls this both when a session starts, with completionStatus 'skipped' as the honest starting point, and again at finish with the real final status). `energy` is optional so callers that don't have it don't need a fake value. */
export async function recordSessionCompletion(
  completed: boolean,
  energy?: EnergyScore,
  completionStatus?: CompletionStatus,
  caloriesBurned?: number
) {
  const date = localDateStr();
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  // Merged, not replaced — a call after notes/feedback were already
  // attached (saveSessionNote/saveSessionFeedback) must not silently wipe
  // them; only the fields this function actually owns get overwritten.
  const existingToday = entries.find((e) => e.date === date);
  const withoutToday = entries.filter((e) => e.date !== date);
  // Keeps whichever hour was already recorded for today (the start-of-
  // check-in call) rather than letting the later finish-of-session call
  // overwrite it with a much noisier "when did they finish" hour — see
  // checkedInAtHour's own doc comment.
  const checkedInAtHour = existingToday?.checkedInAtHour ?? new Date().getHours();
  // BUG FIX (found in a later full-app audit): this used to write
  // `caloriesBurned` unconditionally from the parameter, unlike
  // checkedInAtHour just above — a call with no 4th argument (undefined)
  // would silently overwrite an already-recorded real value with nothing.
  // Same existingToday-preserving fallback pattern checkedInAtHour uses.
  const resolvedCaloriesBurned = caloriesBurned ?? existingToday?.caloriesBurned;
  const next = [
    ...withoutToday,
    { ...existingToday, date, completed, energy, completionStatus, checkedInAtHour, caloriesBurned: resolvedCaloriesBurned },
  ].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

/**
 * Same real semantics as recordSessionCompletion, but for an explicit past
 * date rather than always today — the write path behind Progress &
 * History's "Log a Past Session" flow (check-in.tsx's own live flow always
 * logs today via recordSessionCompletion; this is the separate, honest
 * backfill path for a day that already happened and was never logged in
 * real time). Deliberately does NOT touch check-in-history.ts's
 * lastCheckIn — that field is reserved for the most recent REAL, live
 * check-in the engine actually used for "yesterday" comparisons, and a
 * backfilled entry (which never ran through computePlanPreview at all)
 * shouldn't silently become "yesterday" for tomorrow's engine comparison.
 */
export async function recordPastSessionCompletion(
  date: string,
  completed: boolean,
  energy?: EnergyScore,
  completionStatus?: CompletionStatus,
  soreness?: EnergyScore
) {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const withoutDate = entries.filter((e) => e.date !== date);
  const next = [
    ...withoutDate,
    { date, completed, energy, completionStatus, soreness, loggedRetroactively: true },
  ].slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, next);
}

export async function clearSessionHistory() {
  await clearStoredValue(KEY);
}

/** Removes a single logged entry by date — the per-row swipe-to-delete on Progress & History. */
export async function deleteSessionHistoryEntry(date: string) {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  await writeJsonValue(KEY, entries.filter((e) => e.date !== date));
}

/** Every stored entry, most recent first — the real log behind Settings' Progress & History. */
export async function getSessionHistory(): Promise<SessionHistoryEntry[]> {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Overwrites the whole log wholesale — data-backup.ts's restore path only.
 * Re-applies the same MAX_ENTRIES trim recordSessionCompletion always does,
 * so a restore can't exceed the log's normal rolling-window size even if
 * the exported payload somehow held more. */
export async function restoreSessionHistory(entries: SessionHistoryEntry[]): Promise<void> {
  const trimmed = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_ENTRIES);
  await writeJsonValue(KEY, trimmed);
}

/**
 * Attaches (or clears, if empty) a free-text note to a day's existing
 * entry — safe to call on every keystroke, same as recordSessionCompletion.
 * No-ops if that day has no entry yet, since a note can only be attached to
 * a session that was actually logged, never fabricated on its own.
 */
export async function saveSessionNote(date: string, notes: string) {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const trimmed = notes.trim();
  const next = entries.map((e) => (e.date === date ? { ...e, notes: trimmed || undefined } : e));
  await writeJsonValue(KEY, next);
}

/** The note for a single day, if one was saved — prefills the field when reopening an already-finished session. */
export async function getSessionNote(date: string): Promise<string | undefined> {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  return entries.find((e) => e.date === date)?.notes;
}

/** Records which post-session feedback button was tapped for a day — same no-op-if-no-entry-yet contract as saveSessionNote. The calibration update itself happens separately, in calibration.ts's submitSessionFeedback; this is just the "did I already ask today" record. */
export async function saveSessionFeedback(date: string, feedback: FeedbackResponse) {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const next = entries.map((e) => (e.date === date ? { ...e, feedback } : e));
  await writeJsonValue(KEY, next);
}

/** The feedback given for a single day, if any — lets check-in.tsx skip re-asking when reopening an already-finished session. */
export async function getSessionFeedback(date: string): Promise<FeedbackResponse | undefined> {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  return entries.find((e) => e.date === date)?.feedback;
}

export type WeekDay = {
  weekday: string;
  /** YYYY-MM-DD — the real calendar date this cell represents. Added so
   * callers can label a specific date (Progress's own month grid otherwise
   * has no way to say which real week a row is) or navigate to that day's
   * detail, not just its weekday name. */
  date: string;
  /** null = in the future, OR a past scheduled day with no recorded entry at
   * all (see isFuture below for how to tell those two apart — they used to
   * be indistinguishable here, which was a real bug: recordSessionCompletion
   * only ever writes an entry once "Start Session" is tapped, so a day the
   * user never opened check-in on at all has zero entry, not a `false` one.
   * That made an already-passed, silently-skipped day render identically to
   * a genuine future day). true/false = scheduled day's real outcome. */
  completed: boolean | null;
  isToday: boolean;
  isScheduled: boolean;
  /** Added alongside the fix above — callers must check this before treating
   * completed:null as "upcoming." false + completed:null means "this day
   * already happened and nothing was ever logged for it," which reads the
   * same as a real miss, not as still-pending. */
  isFuture: boolean;
  /** That day's real calorie-estimate.ts session estimate, if any — the
   * same per-session number getWeeklyCaloriesBurned already sums across the
   * week. Undefined (not 0) for a future day, a day with no entry, or an
   * entry logged before caloriesBurned existed — a real "no data" rather
   * than a false "zero effort," so callers rendering this per-day (Home's
   * own training-load chart) don't draw a logged rest day and a genuinely
   * unknown day identically. */
  caloriesBurned?: number;
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
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const byDate = new Map(entries.map((e) => [e.date, e.completed]));
  // Full entry too, not just its `completed` flag — Home's training-load
  // chart needs that day's real caloriesBurned, same field
  // getWeeklyCaloriesBurned already sums across the week.
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  // BUG FIX: a day is only real "scheduled" if the account actually existed
  // yet — without this floor, a brand-new account whose weekly pattern
  // includes, say, Monday–Thursday saw those same-week days rendered as
  // missed red dots the moment it was created on a Friday, despite the
  // account (and its plan) not existing on any of them yet. Null (no
  // account-start recorded at all) never excludes anything — same as
  // before this fix existed.
  const accountStartDate = await getAccountStartDate();

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
    const isScheduled =
      (scheduledDays?.includes(weekday) ?? false) && (!accountStartDate || dateStr >= accountStartDate);
    const todayStr = localDateStr(now);
    const isFuture = dateStr > todayStr;
    return {
      weekday,
      date: dateStr,
      completed: isFuture ? null : (byDate.get(dateStr) ?? null),
      isToday: dateStr === todayStr,
      isScheduled,
      isFuture,
      caloriesBurned: isFuture ? undefined : entryByDate.get(dateStr)?.caloriesBurned,
    };
  });

  const scheduledCount = days.filter((d) => d.isScheduled).length;
  const completedCount = days.filter((d) => d.isScheduled && d.completed).length;

  return { days, completedCount, scheduledCount };
}

/**
 * Sum of calorie-estimate.ts's real per-session estimates across this
 * calendar week (Monday–Sunday, same boundary as getWeekActivity) — the
 * data behind the Home weekly card's "X of Y kcal this week" line once a
 * weeklyCalorieBurnGoal is set. Entries logged before caloriesBurned existed,
 * or with no honest estimate available at the time (no weightKg on the
 * profile), simply contribute 0 rather than breaking the sum — an
 * undercount for old data is honest; a crash isn't.
 */
export async function getWeeklyCaloriesBurned(): Promise<number> {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const now = new Date();
  const todayIndex = now.getDay();
  const mondayOffset = (todayIndex + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const mondayStr = localDateStr(monday);
  const todayStr = localDateStr(now);
  return entries
    .filter((e) => e.date >= mondayStr && e.date <= todayStr)
    .reduce((sum, e) => sum + (e.caloriesBurned ?? 0), 0);
}

export type WeeklyCaloriesBurned = { kcal: number; isEstimate: boolean };

/**
 * Combines this week's real HealthKit active-energy total (health-kit.ts's
 * getWeeklyActiveEnergyKcal — real measured activity, not just VerveIn
 * sessions) with the on-device MET-formula estimate getWeeklyCaloriesBurned
 * above computes. HealthKit's real total is preferred whenever connected;
 * the on-device estimate is the same honest fallback check-in.tsx already
 * labels "estimated" elsewhere. Pure, same shape as weight-log.ts's own
 * resolveCurrentWeightKg — callers fetch both sources themselves — so every
 * screen showing this number (Home's weekly card, Profile's Goals ring)
 * resolves it exactly the same way instead of each reimplementing the
 * priority independently and silently drifting apart.
 */
export function resolveWeeklyCaloriesBurned(diskKcal: number, healthKitKcal: number | null): WeeklyCaloriesBurned {
  return healthKitKcal !== null ? { kcal: healthKitKcal, isEstimate: false } : { kcal: diskKcal, isEstimate: true };
}

/**
 * Same shape as getWeekActivity but for the last `weekCount` calendar weeks
 * (oldest first, current week last) — the data behind Progress's consistency
 * grid. Every cell is still cross-referenced against scheduledDays, so an
 * unscheduled day reads as "no dot," not a missed session — same
 * account-start floor as getWeekActivity above, and more visible here: a
 * brand-new account's own MONTH_WEEK_COUNT-week grid used to render entire
 * calendar weeks from before the account existed as rows of missed cells.
 */
export async function getRecentWeeks(scheduledDays: string[] | null, weekCount = 4): Promise<WeekDay[][]> {
  const entries = await readJsonList<SessionHistoryEntry>(KEY);
  const byDate = new Map(entries.map((e) => [e.date, e.completed]));
  const accountStartDate = await getAccountStartDate();

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
      const isScheduled =
        (scheduledDays?.includes(weekday) ?? false) && (!accountStartDate || dateStr >= accountStartDate);
      const isFuture = dateStr > todayStr;
      return {
        weekday,
        date: dateStr,
        completed: isFuture ? null : (byDate.get(dateStr) ?? null),
        isToday: dateStr === todayStr,
        isScheduled,
        isFuture,
      };
    });
    weeks.push(days);
  }
  return weeks;
}

// Deliberately no streak-counting function here. The research vault this
// engine was ported from has an explicit Founder Decision against it
// ("Streaks counter replaced with a weekly recap... someone who has a bad
// week is exactly who's supposed to feel safe here, not guilty") and it's
// on that vault's own Anti-Roadmap as a permanent never-build. If a future
// change wants a "how am I doing" signal, use getWeekActivity/
// getRecentWeeks' real completedCount instead of reintroducing this.
