import type { EnergyScore } from '@/components/home/energy-gauge';

/**
 * Only ever says something earned — a real streak or a genuinely strong
 * completion ratio. No fallback filler for a quiet week, since fabricated
 * encouragement is exactly what this app's mockup data has to avoid.
 * Shared between Home's dashboard greeting and check-in's post-session
 * screen (see getPostSessionNote below) so both draw on the same rule
 * rather than two copies drifting apart.
 */
export function getMomentumNote(
  streak: number,
  weekActivity: { completedCount: number; scheduledCount: number }
): { text: string; hasStreak: boolean } | null {
  if (streak >= 2) return { text: `${streak}-day streak — keep it going`, hasStreak: true };
  if (weekActivity.scheduledCount > 0 && weekActivity.completedCount / weekActivity.scheduledCount >= 0.75) {
    return { text: 'Building solid momentum', hasStreak: false };
  }
  return null;
}

/**
 * The post-session counterpart — same rule (only ever earned, never generic
 * filler), but has a signal Home's dashboard view doesn't: today's actual
 * energy score. Finishing a session on a real low-energy day is its own
 * honest accomplishment, distinct from a streak — checked first since it's
 * the more specific, more earned claim on a day it applies.
 */
export function getPostSessionNote(streak: number, energy: EnergyScore): string | null {
  if (energy <= 2 && streak >= 2) {
    return `Showed up on a low-energy day, and it's a ${streak}-day streak. That's the hard part.`;
  }
  if (energy <= 2) {
    return 'Showing up on a low-energy day is its own win.';
  }
  if (streak >= 2) {
    return `${streak}-day streak — keep it going.`;
  }
  return null;
}
