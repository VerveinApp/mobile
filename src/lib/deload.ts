import { checkDeloadPattern } from '@/lib/engine/deload-nudge';
import type { DeloadNudge } from '@/lib/engine/types';
import { getSessionHistory } from '@/lib/session-history';

/**
 * Reads the real session log and checks for M16's three-consecutive-
 * low-energy-day pattern. Entries logged before energy tracking existed
 * (undefined `energy`) are skipped rather than treated as a match or a
 * break — the safe failure mode is under-triggering, never a false nudge.
 */
export async function getDeloadNudge(): Promise<DeloadNudge> {
  const history = await getSessionHistory(); // most-recent-first
  const withEnergy = history.filter((e) => e.energy !== undefined);
  const recent = withEnergy.slice(0, 3).map((e) => ({ date: e.date, energy: e.energy as number }));
  return checkDeloadPattern(recent);
}
