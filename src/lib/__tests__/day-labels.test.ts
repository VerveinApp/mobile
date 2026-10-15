import { dayPillLabel, recentDays } from '@/lib/day-labels';

describe('day picker dates', () => {
  it('lists the last days today first, across a month boundary', () => {
    expect(recentDays(4, new Date(2026, 9, 2))).toEqual(['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29']);
  });

  it('labels today, yesterday and earlier days', () => {
    expect(dayPillLabel('2026-10-14', '2026-10-14').text).toBe('Today');
    expect(dayPillLabel('2026-10-13', '2026-10-14').text).toBe('Yesterday');
    expect(dayPillLabel('2026-10-12', '2026-10-14')).toEqual({ text: 'Mon 12', spoken: 'Monday, Oct 12' });
    expect(dayPillLabel('2026-09-30', '2026-10-01').text).toBe('Yesterday');
  });
});
