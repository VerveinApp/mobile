// Frozen reference data — ported verbatim from the adaptive-engine research
// vault's src/reference/energy-modifier-table.ts (traces to "Energy Score.md"'s
// Energy Modifier Table). Data, not logic: nothing here computes anything.

import type { Impact, Intensity } from '@/lib/engine/types';

export type EnergyModifierRow = {
  label: string;
  setsMultiplier: number;
  durationMultiplier: number;
  intensityCeiling: Intensity;
  impactCeiling: Impact;
};

export const ENERGY_MODIFIER_TABLE: Record<1 | 2 | 3 | 4 | 5, EnergyModifierRow> = {
  1: { label: 'Running on empty', setsMultiplier: 0, durationMultiplier: 0.3, intensityCeiling: 'low', impactCeiling: 'low' },
  2: { label: 'Low energy', setsMultiplier: 0.6, durationMultiplier: 0.6, intensityCeiling: 'low', impactCeiling: 'low' },
  3: { label: 'Okay', setsMultiplier: 1.0, durationMultiplier: 1.0, intensityCeiling: 'medium', impactCeiling: 'high' },
  4: { label: 'Good', setsMultiplier: 1.0, durationMultiplier: 1.0, intensityCeiling: 'high', impactCeiling: 'high' },
  5: { label: 'Energized', setsMultiplier: 1.0, durationMultiplier: 1.0, intensityCeiling: 'high', impactCeiling: 'high' },
};
