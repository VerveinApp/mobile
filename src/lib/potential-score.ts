/**
 * Placeholder stand-in for a real fitness-potential model, same spirit as
 * plan-preview.ts: a deterministic, honest computation over the user's
 * actual answers (not fabricated per-copy numbers), isolated in its own
 * module so swapping in a real model later is a contained change.
 *
 * Despite the name, nothing here actually reads biometric data — only
 * goal/experience/commitment/days, all collected from every user regardless
 * of the health-consent branch. Originally only called from the
 * consent-branch payoff screen (onboarding/potential.tsx), it's now also
 * the basis for the Summary dashboard's Fitness/Trends cards for everyone.
 */

export type PotentialInput = {
  goal?: string;
  experience?: string;
  commitmentLevel?: string;
  days?: string;
  duration?: string;
};

export type PotentialPillar = {
  key: 'muscleGain' | 'strength' | 'endurance' | 'fatLoss' | 'consistency';
  label: string;
  value: number;
  tier: 'Moderate' | 'High';
};

export type PotentialResult = {
  pillars: PotentialPillar[];
  overall: number;
  leadPillars: string[];
  trajectory: { label: string; value: number }[];
  peak: number;
};

// Skewed toward the flattering end on purpose — this is the number a brand
// new user sees seconds after finishing onboarding, before they've done a
// single session. A beginner base in the low 40s read as "you have a long
// way to go," which is true but not the job of this particular screen; the
// boost is heaviest at the low end (where first-session encouragement
// matters most for conversion) and tapers off for already-experienced
// users, who don't need the same lift.
const EXPERIENCE_BASE: Record<string, number> = {
  'just-starting': 58,
  'trained-before': 68,
  'train-regularly': 76,
  'years-experience': 84,
};

const GOAL_BIAS: Record<string, Partial<Record<PotentialPillar['key'], number>>> = {
  'build-physique': { muscleGain: 14, strength: 8 },
  'get-leaner': { fatLoss: 15, endurance: 6 },
  'get-stronger': { strength: 15, muscleGain: 6 },
  'move-better': { endurance: 14, consistency: 6 },
};

// Floor raised from a plain 30 — nobody should land on a discouraging
// double-digit-in-the-30s score on the screen meant to sell them on signing
// up.
function clamp(n: number, min = 45, max = 95): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function computePotential(input: PotentialInput): PotentialResult {
  const base = EXPERIENCE_BASE[input.experience ?? ''] ?? 54;
  const commitment = Number(input.commitmentLevel) || 4;
  const commitmentBoost = (commitment - 4) * 3;
  const dayCount = (input.days ?? '').split(',').filter(Boolean).length;
  const bias = GOAL_BIAS[input.goal ?? ''] ?? {};

  const raw: Record<PotentialPillar['key'], number> = {
    muscleGain: base + commitmentBoost + (bias.muscleGain ?? 0),
    strength: base + commitmentBoost + (bias.strength ?? 0),
    endurance: base + commitmentBoost + (bias.endurance ?? 0),
    fatLoss: base + commitmentBoost + (bias.fatLoss ?? 0),
    consistency: base + commitmentBoost * 1.4 + dayCount * 3 + (bias.consistency ?? 0),
  };

  const labels: Record<PotentialPillar['key'], string> = {
    muscleGain: 'Muscle Gain',
    strength: 'Strength',
    endurance: 'Endurance',
    fatLoss: 'Fat Loss',
    consistency: 'Consistency',
  };

  const pillars: PotentialPillar[] = (Object.keys(raw) as PotentialPillar['key'][]).map((key) => {
    const value = clamp(raw[key]);
    return { key, label: labels[key], value, tier: value >= 75 ? 'High' : 'Moderate' };
  });

  const overall = clamp(pillars.reduce((sum, p) => sum + p.value, 0) / pillars.length);
  const leadPillars = [...pillars]
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((p) => p.label);

  // "Now" is `overall` itself — the same number the headline shows — not a
  // second, independently-deflated figure. The headline says "Overall
  // Potential" and the trajectory's first point claims to be "Now"; those
  // have to be the same value or the screen is telling the user two
  // different things about where they stand today. Growth from there is a
  // soft, hedged projection — "could reach" framing only, not a guarantee.
  const now = overall;
  const mid = clamp(overall + 6, overall, 96);
  const peak = clamp(overall + 14, overall, 98);

  return {
    pillars,
    overall,
    leadPillars,
    peak,
    trajectory: [
      { label: 'Now', value: now },
      { label: '6 Months', value: mid },
      { label: 'Peak potential', value: peak },
    ],
  };
}
