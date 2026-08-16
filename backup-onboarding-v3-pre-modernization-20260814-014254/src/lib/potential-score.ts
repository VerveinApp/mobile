/**
 * Placeholder stand-in for a real fitness-potential model, same spirit as
 * plan-preview.ts: a deterministic, honest computation over the user's
 * actual answers (not fabricated per-copy numbers), isolated in its own
 * module so swapping in a real model later is a contained change.
 *
 * Only reachable after the user has consented to share biometrics — every
 * input here is something they actually provided, not guessed.
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

const EXPERIENCE_BASE: Record<string, number> = {
  'just-starting': 42,
  'trained-before': 54,
  'train-regularly': 66,
  'years-experience': 76,
};

const GOAL_BIAS: Record<string, Partial<Record<PotentialPillar['key'], number>>> = {
  'build-physique': { muscleGain: 14, strength: 8 },
  'get-leaner': { fatLoss: 15, endurance: 6 },
  'get-stronger': { strength: 15, muscleGain: 6 },
  'move-better': { endurance: 14, consistency: 6 },
};

function clamp(n: number, min = 30, max = 95): number {
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

  // A soft, hedged projection — not a guarantee. "Could reach" framing only.
  const now = clamp(overall - 35, 20, 90);
  const mid = clamp(overall - 12, 20, 92);
  const peak = clamp(overall + 8, overall, 95);

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
