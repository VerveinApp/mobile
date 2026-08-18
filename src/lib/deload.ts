import { checkDeloadPattern } from '@/lib/engine/deload-nudge';
import type { DeloadNudge } from '@/lib/engine/types';
import { getRecentRestingHeartRate } from '@/lib/health-kit';
import { getSessionHistory } from '@/lib/session-history';

/**
 * Reads the real session log and checks for M16's three-consecutive-
 * low-energy-day pattern. Entries logged before energy tracking existed
 * (undefined `energy`) are skipped rather than treated as a match or a
 * break — the safe failure mode is under-triggering, never a false nudge.
 */
async function getEnergyDeloadNudge(): Promise<DeloadNudge> {
  const history = await getSessionHistory(); // most-recent-first
  const withEnergy = history.filter((e) => e.energy !== undefined);
  const recent = withEnergy.slice(0, 3).map((e) => ({ date: e.date, energy: e.energy as number }));
  return checkDeloadPattern(recent);
}

// A sustained resting-heart-rate elevation is a real, commonly-used
// recovery signal distinct from self-reported energy — but this is
// deliberately NOT folded into M16's own checkDeloadPattern (that module is
// a verbatim port of the vault's exact interim rule; extending its logic
// here would blur what's real vault logic vs. an app-side addition). This
// runs as a separate, additive check instead: self-normalized against the
// user's own trailing baseline (never a fixed absolute bpm target, same
// principle as the Training Balance radar), and only when there's enough
// real data to say anything — under-triggering is always the safe failure
// mode, same as the energy-based check above.
const RHR_ELEVATION_THRESHOLD = 1.07; // +7% sustained — within the commonly-cited 5-10% range for reduced-recovery signals
const RHR_MIN_BASELINE_DAYS = 4;

async function getHeartRateDeloadNudge(): Promise<DeloadNudge> {
  const samples = await getRecentRestingHeartRate(10); // oldest-first
  if (samples.length < RHR_MIN_BASELINE_DAYS + 3) return { triggered: false, message: null };

  const recent = samples.slice(-3);
  const baseline = samples.slice(0, -3);
  const recentAvg = recent.reduce((sum, s) => sum + s.value, 0) / recent.length;
  const baselineAvg = baseline.reduce((sum, s) => sum + s.value, 0) / baseline.length;

  if (recentAvg >= baselineAvg * RHR_ELEVATION_THRESHOLD) {
    return {
      triggered: true,
      message: 'Your resting heart rate has been higher than usual the past few days — consider taking it easier.',
    };
  }
  return { triggered: false, message: null };
}

/** Energy-based (M16, vault-verbatim) takes precedence — it's the more
 * established, deliberately conservative signal. The heart-rate check only
 * runs as a fallback when energy alone hasn't already flagged anything, and
 * only ever fires from real HealthKit data (getRecentRestingHeartRate
 * already returns empty when not connected). */
export async function getDeloadNudge(): Promise<DeloadNudge> {
  const energyNudge = await getEnergyDeloadNudge();
  if (energyNudge.triggered) return energyNudge;
  return getHeartRateDeloadNudge();
}
