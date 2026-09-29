import type { UnitSystem } from '@/lib/unit-preference';

/**
 * Strength-logging weights are always STORED in kg (exercise-performance.ts,
 * the 1RM math, every backup) and converted only at the edges — what the
 * user types and what they read. Same "metric internally, convert for
 * display/input" rule user-profile.ts's own weightKg already follows.
 *
 * BUG FIX this module exists for: the mid-workout "Weight used" field, the
 * plate calculator, the "Last time" hint and Progress's estimated 1RM were
 * all hardwired to kg while the app defaults to imperial — a US user typing
 * "135" (meaning pounds) had 135 kg recorded, and every PR, hint and trend
 * built on it read 2.2× too heavy.
 *
 * Same lb factor profile.tsx/weight-history.tsx/biometrics-sheet.tsx already
 * use, so a value entered here and shown there round-trips identically.
 */
export const KG_PER_LB = 0.453592;

export function weightUnitLabel(unit: UnitSystem): 'kg' | 'lb' {
  return unit === 'metric' ? 'kg' : 'lb';
}

export function kgToDisplayWeight(kg: number, unit: UnitSystem): number {
  return unit === 'metric' ? kg : kg / KG_PER_LB;
}

export function displayWeightToKg(value: number, unit: UnitSystem): number {
  return unit === 'metric' ? value : value * KG_PER_LB;
}

/** "135", "52.5", "61.2" — at most one decimal, never a trailing ".0". */
export function formatWeightNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A stored kg value, shown in the user's own unit: "135 lb" / "61.2 kg". */
export function formatWeight(kg: number, unit: UnitSystem): string {
  return `${formatWeightNumber(kgToDisplayWeight(kg, unit))} ${weightUnitLabel(unit)}`;
}

/**
 * Parses a typed decimal the way the keypad actually produced it. iOS's
 * decimal pad types a COMMA in most of Europe and much of the world, and
 * `Number("72,5")` is NaN — so a real entry used to be silently dropped.
 * Accepts either separator (one of them), trims whitespace, and returns
 * null for anything that isn't a finite number, never a guess.
 */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || !/^\d*\.?\d*$/.test(normalized) || normalized === '.') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
