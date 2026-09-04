import { calculatePlates, formatPlateBreakdown } from '@/lib/plate-calculator';

describe('calculatePlates', () => {
  it('returns an empty bar for a target at or below the bar weight', () => {
    expect(calculatePlates(20)).toEqual({ platesPerSide: [], actualWeightKg: 20 });
    expect(calculatePlates(15)).toEqual({ platesPerSide: [], actualWeightKg: 20 });
  });

  it('breaks down a clean target using the largest plates first', () => {
    // 60kg = 20 bar + 40 total = 20 per side = one 20 plate.
    expect(calculatePlates(60)).toEqual({ platesPerSide: [20], actualWeightKg: 60 });
  });

  it('combines multiple plate sizes per side for a less round target', () => {
    // 100kg = 20 bar + 80 total = 40 per side = 25 + 15.
    expect(calculatePlates(100)).toEqual({ platesPerSide: [25, 15], actualWeightKg: 100 });
  });

  it('rounds down, never up, when the exact target is not hittable', () => {
    // 21kg = 20 bar + 1 total = 0.5 per side, below the smallest plate (1.25) — empty bar.
    expect(calculatePlates(21)).toEqual({ platesPerSide: [], actualWeightKg: 20 });
  });

  it('uses a custom barbell weight when provided', () => {
    // 15kg bar + 10 total = 5 per side = one 5 plate.
    expect(calculatePlates(25, 15)).toEqual({ platesPerSide: [5], actualWeightKg: 25 });
  });
});

describe('formatPlateBreakdown', () => {
  it('reports an empty bar plainly', () => {
    expect(formatPlateBreakdown({ platesPerSide: [], actualWeightKg: 20 })).toBe('Empty bar');
  });

  it('joins plates largest first with the per-side qualifier', () => {
    expect(formatPlateBreakdown({ platesPerSide: [25, 15], actualWeightKg: 100 })).toBe('25 + 15 per side');
  });

  it('formats a fractional plate without a trailing zero', () => {
    expect(formatPlateBreakdown({ platesPerSide: [2.5], actualWeightKg: 25 })).toBe('2.5 per side');
  });
});
