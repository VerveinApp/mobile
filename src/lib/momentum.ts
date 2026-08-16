import type { EnergyScore } from '@/components/home/energy-gauge';

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
