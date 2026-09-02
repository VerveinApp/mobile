import type { EnergyScore } from '@/components/home/energy-gauge';
import { localDateStr } from '@/lib/local-date';
import type { SessionHistoryEntry } from '@/lib/session-history';
import type { RecordPerformanceResult } from '@/lib/exercise-performance';

/**
 * The vault's actual prescribed pattern, not a streak counter — see the
 * research vault's Decision Log ("Streaks counter replaced with a weekly
 * 'you moved X times' recap, framed as observation, not score") and
 * Anti-Roadmap ("Streak counter — punishes the target user on their worst
 * days"). No number chased, no "keep it going" pressure, and blameless
 * means silence is a valid state too — no banner at all rather than a
 * discouraging one when the week's been quiet.
 */
export function getWeeklyRecap(weekActivity: { completedCount: number; scheduledCount: number }): string | null {
  if (weekActivity.completedCount <= 0) return null;
  return `${weekActivity.completedCount} session${weekActivity.completedCount === 1 ? '' : 's'} this week`;
}

/**
 * The post-session counterpart — same rule (only ever earned, never
 * generic filler, never a streak). Energy is real, check-in-specific
 * signal check-in.tsx has that a weekly count doesn't: finishing a session
 * on a real low-energy day is its own honest accomplishment.
 */
export function getPostSessionNote(energy: EnergyScore): string | null {
  if (energy <= 2) {
    return 'Showing up on a low-energy day is its own win.';
  }
  return null;
}

const PACING_TREND_WINDOW_DAYS = 14;
// Each window needs its own real sample, same reasoning as
// personal-calibration.ts's own established-tier threshold — small samples
// swing wildly and would make this fire on noise, not a real trend.
const PACING_TREND_MIN_SAMPLE = 5;
// A meaningful jump, not sampling noise — 15 points is roughly one more
// "just right" out of every 7 sessions than before.
const PACING_TREND_MIN_IMPROVEMENT = 0.15;

/**
 * Recognizes a real improvement in how often "how did that feel?" feedback
 * comes back "just right," comparing the last two weeks against the two
 * weeks before that. Deliberately one-directional, same rule as every other
 * note in this file: only ever earned, never a discouraging or neutral-but-
 * implicitly-bad message when the rate is flat or down — silence is the
 * correct output for those cases, not a lesser version of this note.
 *
 * This is jointly produced by the calibration multiplier converging on this
 * person (personal-calibration.ts) and by how accurately they're reading
 * their own energy at check-in — not a pure personal-skill score — so the
 * copy credits "your pacing calls" (the read), not an implied body-level
 * claim the data can't actually support.
 */
export function getPacingTrendNote(entries: SessionHistoryEntry[]): string | null {
  const withFeedback = entries.filter((e) => e.feedback !== undefined);
  const todayMs = new Date(`${localDateStr()}T00:00:00`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (dateStr: string) => Math.floor((todayMs - new Date(`${dateStr}T00:00:00`).getTime()) / dayMs);

  const recent = withFeedback.filter((e) => {
    const d = daysAgo(e.date);
    return d >= 0 && d < PACING_TREND_WINDOW_DAYS;
  });
  const prior = withFeedback.filter((e) => {
    const d = daysAgo(e.date);
    return d >= PACING_TREND_WINDOW_DAYS && d < PACING_TREND_WINDOW_DAYS * 2;
  });
  if (recent.length < PACING_TREND_MIN_SAMPLE || prior.length < PACING_TREND_MIN_SAMPLE) return null;

  const justRightRate = (list: SessionHistoryEntry[]) =>
    list.filter((e) => e.feedback === 'just_right').length / list.length;
  if (justRightRate(recent) - justRightRate(prior) >= PACING_TREND_MIN_IMPROVEMENT) {
    return 'Your pacing calls have gotten sharper these last couple weeks.';
  }
  return null;
}

/**
 * Recognizes a real, earned strength gain on a specific exercise — same
 * rule as every other note in this file: only ever fires on genuine
 * improvement, silence otherwise, never a discouraging or neutral message
 * when nothing improved. The threshold itself lives in
 * exercise-performance.ts (result.current.improved) since it's decided and
 * persisted at write time, not recomputed here — this function only picks
 * which improvement, if any, is worth naming. When more than one exercise
 * improved this session, names only the single biggest jump — a list of
 * every exercise that went up would read as a report, not a moment.
 */
export function getLoadImprovementNote(
  results: { exerciseName: string; result: RecordPerformanceResult }[]
): string | null {
  const improved = results.filter(({ result }) => result.current.improved);
  if (improved.length === 0) return null;
  const biggest = improved.reduce((best, current) =>
    current.result.oneRepMaxRatio > best.result.oneRepMaxRatio ? current : best
  );
  return `You moved more weight on ${biggest.exerciseName} than last time.`;
}

/**
 * Vervein addition, not in the vault — the text body for Home's "share your
 * week" affordance (Share.share(), same mechanism referral.tsx already
 * uses). Built from getWeeklyRecap's own real count, same blameless-silence
 * rule: returns null (no share content at all) on a quiet week rather than
 * a discouraging or padded-out message. `recentStrengthGain` is optional and
 * additive only — the caller's job to decide whether one exists (see
 * exercise-performance.ts's own persisted `improved`/`date` fields), never
 * fabricated here if it's absent.
 */
export function getShareableWeeklyRecapText(
  weekActivity: { completedCount: number; scheduledCount: number },
  recentStrengthGain?: { exerciseName: string; estimatedOneRepMaxKg: number } | null
): string | null {
  const recap = getWeeklyRecap(weekActivity);
  if (!recap) return null;
  const highlight = recentStrengthGain
    ? ` Also hit a new estimated 1RM on ${recentStrengthGain.exerciseName}: ${Math.round(recentStrengthGain.estimatedOneRepMaxKg)} kg.`
    : '';
  return `${recap} on VerveIn.${highlight}`;
}
