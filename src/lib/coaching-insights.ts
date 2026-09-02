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
 * The one earned aside this app currently surfaces about a detected
 * pattern, not a stats dashboard — general and retrospective (never tied to
 * "is today the day after," which would risk nudging someone toward
 * over-reporting energy live at check-in, undermining the honesty of the
 * self-report that feeds calibration in the first place). Silent whenever
 * the pattern isn't real yet, or was already shown within COOLDOWN_DAYS —
 * same "silence is a valid state" rule as every other note in momentum.ts.
 */
export async function getCoachingInsightNote(entries: SessionHistoryEntry[]): Promise<string | null> {
  if (countUnderselledEnergyOccurrences(entries) < MIN_OCCURRENCES) return null;
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
  return 'You tend to undersell your energy the day after a rough one — worth remembering next time one hits.';
}
