import { localDateStr } from '@/lib/local-date';

describe('localDateStr', () => {
  it('formats a real date as YYYY-MM-DD using LOCAL calendar fields, not UTC', () => {
    const d = new Date(2026, 0, 5); // January 5, 2026, local time — month is 0-indexed
    expect(localDateStr(d)).toBe('2026-01-05');
  });

  it('pads single-digit months and days with a leading zero', () => {
    const d = new Date(2026, 8, 1); // September 1, 2026
    expect(localDateStr(d)).toBe('2026-09-01');
  });

  it('does not shift the date across a UTC boundary the way toISOString would', () => {
    // 11:30pm local time — a naive `toISOString().slice(0, 10)` on a
    // negative-UTC-offset system would already read as the NEXT UTC day.
    // localDateStr must stay anchored to the LOCAL calendar day regardless.
    const d = new Date(2026, 5, 15, 23, 30, 0);
    expect(localDateStr(d)).toBe('2026-06-15');
  });

  it('defaults to the current moment when no date is passed', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(localDateStr()).toBe(expected);
  });
});
