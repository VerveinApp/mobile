import { countEnergyLevels, foldIntoOther, sparklineXs, toPercentShares } from '@/lib/chart-math';

describe('sparklineXs', () => {
  it("'even' spacing matches Sparkline's original equal steps", () => {
    expect(sparklineXs(['2026-10-01', '2026-10-02', '2026-10-09'], 108, 4, 'even')).toEqual([4, 54, 104]);
  });

  it("'date' spacing puts a long break between entries as a real gap", () => {
    // 1 day, then 8 days — the third point sits 9/9 of the way, the second 1/9.
    expect(sparklineXs(['2026-10-01', '2026-10-02', '2026-10-10'], 98, 4, 'date')).toEqual([4, 14, 94]);
  });

  it('crosses a DST change without shifting any point', () => {
    const xs = sparklineXs(['2026-11-01', '2026-11-02', '2026-11-03'], 100, 0, 'date');
    expect(xs).toEqual([0, 50, 100]);
  });

  it('falls back to even spacing when a date is missing, out of order, or all the same day', () => {
    const even = [0, 50, 100];
    expect(sparklineXs(['2026-10-01', undefined, '2026-10-05'], 100, 0, 'date')).toEqual(even);
    expect(sparklineXs(['2026-10-05', '2026-10-01', '2026-10-09'], 100, 0, 'date')).toEqual(even);
    expect(sparklineXs(['2026-10-01', '2026-10-01', '2026-10-01'], 100, 0, 'date')).toEqual(even);
  });

  it('centers a single point and returns nothing for no points', () => {
    expect(sparklineXs(['2026-10-01'], 120, 4, 'date')).toEqual([60]);
    expect(sparklineXs([], 120, 4, 'date')).toEqual([]);
  });
});

describe('toPercentShares', () => {
  it('always adds up to exactly 100', () => {
    const shares = toPercentShares([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it('gives the leftover points to the largest remainders', () => {
    // 28.57, 28.57, 42.86 → floors 28, 28, 42 (98); the .86 takes one, then
    // the first .57 (a tie goes to the earlier item).
    expect(toPercentShares([2, 2, 3])).toEqual([29, 28, 43]);
  });

  it('returns zeros for no data rather than dividing by zero', () => {
    expect(toPercentShares([0, 0])).toEqual([0, 0]);
  });
});

describe('foldIntoOther', () => {
  const item = (key: string, value: number) => ({ key, label: key, value });

  it('keeps everything, largest first, when it fits', () => {
    expect(foldIntoOther([item('a', 1), item('b', 3), item('c', 2)], 5).map((i) => i.key)).toEqual(['b', 'c', 'a']);
  });

  it('folds everything past maxNamed into one Other', () => {
    const folded = foldIntoOther([item('a', 6), item('b', 5), item('c', 4), item('d', 1), item('e', 1)], 2);
    expect(folded.map((i) => i.key)).toEqual(['a', 'b', 'other']);
    expect(folded[2]).toMatchObject({ label: 'Other', value: 6, otherCount: 3 });
  });

  it('never folds a single leftover into an Other of one', () => {
    expect(foldIntoOther([item('a', 3), item('b', 2), item('c', 1)], 2).map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('drops zero-value items', () => {
    expect(foldIntoOther([item('a', 0), item('b', 2)], 5).map((i) => i.key)).toEqual(['b']);
  });
});

describe('countEnergyLevels', () => {
  it('counts check-ins per level and ignores anything off the 1–5 scale', () => {
    const counts = countEnergyLevels([{ energyScore: 4 }, { energyScore: 4 }, { energyScore: 2 }, { energyScore: 0 }, { energyScore: 3.5 }]);
    expect(counts).toEqual({ 1: 0, 2: 1, 3: 0, 4: 2, 5: 0 });
  });
});
