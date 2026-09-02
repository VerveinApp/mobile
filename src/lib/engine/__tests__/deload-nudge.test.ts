import { checkDeloadPattern } from '@/lib/engine/deload-nudge';

describe('checkDeloadPattern (M16, conservative intersection rule)', () => {
  it('does not trigger with fewer than 3 sessions logged', () => {
    const result = checkDeloadPattern([
      { date: '2026-01-03', energy: 1 },
      { date: '2026-01-02', energy: 1 },
    ]);
    expect(result.triggered).toBe(false);
    expect(result.message).toBeNull();
  });

  it('triggers on 3 consecutive-calendar-day sessions all at Energy 1 (most-recent-first order)', () => {
    const result = checkDeloadPattern([
      { date: '2026-01-03', energy: 1 },
      { date: '2026-01-02', energy: 1 },
      { date: '2026-01-01', energy: 1 },
    ]);
    expect(result.triggered).toBe(true);
    expect(result.message).not.toBeNull();
  });

  it('does not trigger when the energies match but the calendar days are not consecutive', () => {
    const result = checkDeloadPattern([
      { date: '2026-01-10', energy: 1 },
      { date: '2026-01-05', energy: 1 },
      { date: '2026-01-01', energy: 1 },
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when calendar days are consecutive but not all three energies are 1', () => {
    const result = checkDeloadPattern([
      { date: '2026-01-03', energy: 1 },
      { date: '2026-01-02', energy: 2 },
      { date: '2026-01-01', energy: 1 },
    ]);
    expect(result.triggered).toBe(false);
  });

  it('only reads the first three entries — a 4th, non-matching entry cannot break an otherwise-matching pattern', () => {
    const result = checkDeloadPattern([
      { date: '2026-01-03', energy: 1 },
      { date: '2026-01-02', energy: 1 },
      { date: '2026-01-01', energy: 1 },
      { date: '2025-12-25', energy: 5 },
    ]);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger across a month/year boundary miscounted as non-consecutive — real consecutive dates across a boundary still count', () => {
    const result = checkDeloadPattern([
      { date: '2026-02-01', energy: 1 },
      { date: '2026-01-31', energy: 1 },
      { date: '2026-01-30', energy: 1 },
    ]);
    expect(result.triggered).toBe(true);
  });
});
