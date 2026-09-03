import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateStr } from '@/lib/local-date';
import type { SessionHistoryEntry } from '@/lib/session-history';

const LAST_SHOWN_KEY = 'vervein.coachingInsight.lastShown.v1';
// Same "don't fire on noise" rule as personal-calibration.ts's established-
// tier threshold and momentum.ts's own PACING_TREND_MIN_SAMPLE — a rarer,
// more specific two-day pattern gets a slightly stricter bar than a
// single-day rate.
const MIN_OCCURRENCES = 3;
// An occasional aside, not a repeating nag — once surfaced, it stays quiet
// for a real stretch even if the pattern keeps being true.
const COOLDOWN_DAYS = 14;
// A real, deliberately generous bar: this app's own 5-point scale gives
// genuinely different real answers ("much too easy" vs "too easy") more
// room to actually converge on "just right" and stay there for a while
// completely honestly — a well-calibrated week or two of real "just right"
// answers is the SYSTEM WORKING, not a red flag. This only fires on a
// streak long enough that habitual, unread tapping becomes a real
// possibility worth a gentle check, not the first sign of a stable plan.
const CONSECUTIVE_JUST_RIGHT_THRESHOLD = 10;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateStr(date);
}

/**
 * Detects whether "a rough day tends to be followed by underselling energy
 * the next day" is a real, recurring pattern in this person's own history —
 * not the calibration multiplier (that's the algorithm converging on them),
 * this is about how accurately THEY read their own capacity, which is
 * jointly produced by both sides of the coaching relationship, not a pure
 * personal-skill score. Built entirely from session-history.ts's existing
 * per-day feedback/energy — no new tracking required.
 *
 * "Rough day": skipped, felt too hard, or a genuinely low-energy day (<=2).
 * "Undersold the next day": reported low energy (<=2) the very next
 * calendar day, but the resulting (already-lightened) session still came
 * back "too easy" — meaning there was more capacity there than that day's
 * own energy report suggested.
 */
function countUnderselledEnergyOccurrences(entries: SessionHistoryEntry[]): number {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  let occurrences = 0;
  for (const entry of entries) {
    const isRoughDay =
      entry.completionStatus === 'skipped' ||
      entry.feedback === 'too_hard' ||
      entry.feedback === 'much_too_hard' ||
      (entry.energy !== undefined && entry.energy <= 2);
    if (!isRoughDay) continue;
    const next = byDate.get(addDays(entry.date, 1));
    if (
      next &&
      next.energy !== undefined &&
      next.energy <= 2 &&
      (next.feedback === 'too_easy' || next.feedback === 'much_too_easy')
    ) {
      occurrences += 1;
    }
  }
  return occurrences;
}

/**
 * Detects a long unbroken run of "just_right" feedback — this app's whole
 * adaptive loop depends on honest, varied feedback (see personal-
 * calibration.ts's own DELTA_BY_FEEDBACK), and it has no way to tell
 * "genuinely well-calibrated for weeks" apart from "tapping the easiest box
 * without reading it" from the rating alone. Doesn't try to guess which —
 * that's not this function's call to make — just surfaces the honest
 * observation once the streak is long enough to be worth a check. Only
 * counts real, live feedback: a skipped day (no feedback given at all)
 * breaks the streak rather than extending it, and backfilled entries
 * (loggedRetroactively) don't count toward it either — reconstructed-
 * from-memory feedback isn't the same live signal this is watching for.
 */
function countConsecutiveJustRightStreak(entries: SessionHistoryEntry[]): number {
  // getSessionHistory() already returns newest-first; this only reasons
  // about relative order, so it works the same whether or not this
  // particular list happens to be pre-sorted that way already.
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const entry of sorted) {
    if (entry.loggedRetroactively) continue;
    if (entry.feedback === undefined) break;
    if (entry.feedback !== 'just_right') break;
    streak += 1;
  }
  return streak;
}

/**
 * The earned asides this app surfaces about a detected pattern, not a stats
 * dashboard — general and retrospective (never tied to "is today the day
 * after," which would risk nudging someone toward over-reporting energy
 * live at check-in, undermining the honesty of the self-report that feeds
 * calibration in the first place). Silent whenever no pattern is real yet,
 * or one was already shown within COOLDOWN_DAYS — same "silence is a valid
 * state" rule as every other note in momentum.ts. Checked in a fixed order;
 * only ever returns one note per call even if more than one pattern is
 * real, since this is meant to be an occasional aside, not a checklist.
 */
export async function getCoachingInsightNote(entries: SessionHistoryEntry[]): Promise<string | null> {
  let note: string | null = null;
  if (countUnderselledEnergyOccurrences(entries) >= MIN_OCCURRENCES) {
    note = 'You tend to undersell your energy the day after a rough one — worth remembering next time one hits.';
  } else if (countConsecutiveJustRightStreak(entries) >= CONSECUTIVE_JUST_RIGHT_THRESHOLD) {
    note =
      "You've said “just right” for a while now — if that's genuinely true, the plan's doing its job. If tapping through feels automatic, it can only adjust to what you actually tell it.";
  }
  if (!note) return null;
  try {
    const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    if (lastShown) {
      const daysSince = Math.floor((Date.now() - new Date(lastShown).getTime()) / 86400000);
      if (daysSince < COOLDOWN_DAYS) return null;
    }
    await AsyncStorage.setItem(LAST_SHOWN_KEY, localDateStr());
  } catch {
    return null;
  }
  return note;
}
