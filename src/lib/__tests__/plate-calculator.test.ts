import { calculatePlates, formatPlateBreakdown } from '@/lib/plate-calculator';

describe('calculatePlates', () => {
  it('returns an empty bar for a target at or below the bar weight', () => {
    expect(calculatePlates(20)).toEqual({ platesPerSide: [], actualWeightKg: 20, exceedsBarCapacity: false });
    expect(calculatePlates(15)).toEqual({ platesPerSide: [], actualWeightKg: 20, exceedsBarCapacity: false });
  });

  it('breaks down a clean target using the largest plates first', () => {
    // 60kg = 20 bar + 40 total = 20 per side = one 20 plate.
    expect(calculatePlates(60)).toEqual({ platesPerSide: [20], actualWeightKg: 60, exceedsBarCapacity: false });
  });

  it('combines multiple plate sizes per side for a less round target', () => {
    // 100kg = 20 bar + 80 total = 40 per side = 25 + 15.
    expect(calculatePlates(100)).toEqual({ platesPerSide: [25, 15], actualWeightKg: 100, exceedsBarCapacity: false });
  });

  it('rounds down, never up, when the exact target is not hittable — distinct from exceeding bar capacity', () => {
    // 21kg = 20 bar + 1 total = 0.5 per side, below the smallest plate (1.25) — empty bar.
    // Never even reaches the plate-count cap, so this is NOT exceedsBarCapacity.
    expect(calculatePlates(21)).toEqual({ platesPerSide: [], actualWeightKg: 20, exceedsBarCapacity: false });
  });

  it('uses a custom barbell weight when provided', () => {
    // 15kg bar + 10 total = 5 per side = one 5 plate.
    expect(calculatePlates(25, 15)).toEqual({ platesPerSide: [5], actualWeightKg: 25, exceedsBarCapacity: false });
  });

  it('caps at a realistic 8-plates-per-side bar capacity for an absurd target', () => {
    // An unrealistic 99999kg input (bug report: no upper bound) should
    // produce a bounded, physically-loadable breakdown, not dozens of
    // plates. 8 plates of 25kg per side is already a near-record-setting
    // 420kg total (20 bar + 8*25*2) — this MUST be the cap regardless of
    // how much higher the requested target goes.
    const result = calculatePlates(99999);
    expect(result.platesPerSide).toEqual([25, 25, 25, 25, 25, 25, 25, 25]);
    expect(result.platesPerSide.length).toBe(8);
    expect(result.actualWeightKg).toBe(420);
    expect(result.exceedsBarCapacity).toBe(true);
  });

  it('does not flag exceedsBarCapacity for a real, achievable heavy target that exactly fills the cap', () => {
    // 400kg = 20 bar + 380 total = 190 per side = 7*25 + 1*15 = exactly 8
    // plates, landing exactly on the cap without ever needing to reject a
    // 9th plate — a real, physically-loadable target, not an overflow.
    const result = calculatePlates(400);
    expect(result.exceedsBarCapacity).toBe(false);
    expect(result.actualWeightKg).toBe(400);
    expect(result.platesPerSide).toEqual([25, 25, 25, 25, 25, 25, 25, 15]);
  });
});

describe('formatPlateBreakdown', () => {
  it('reports an empty bar plainly', () => {
    expect(formatPlateBreakdown({ platesPerSide: [], actualWeightKg: 20, exceedsBarCapacity: false })).toBe(
      'Empty bar'
    );
  });

  it('joins plates largest first with the per-side qualifier', () => {
    expect(formatPlateBreakdown({ platesPerSide: [25, 15], actualWeightKg: 100, exceedsBarCapacity: false })).toBe(
      '25 + 15 per side'
    );
  });

  it('formats a fractional plate without a trailing zero', () => {
    expect(formatPlateBreakdown({ platesPerSide: [2.5], actualWeightKg: 25, exceedsBarCapacity: false })).toBe(
      '2.5 per side'
    );
  });

  it('appends a real-loaded-weight caveat when bar capacity was exceeded', () => {
    const breakdown = calculatePlates(99999);
    expect(formatPlateBreakdown(breakdown)).toBe(
      '25 + 25 + 25 + 25 + 25 + 25 + 25 + 25 per side (max a standard bar holds — 420kg loaded)'
    );
  });
});
