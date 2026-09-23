import { sleepHoursByNight } from '@/lib/health-kit';

// Local-time constructors on purpose — localDateStr buckets by the device's
// own calendar day, so these read the same in any test-runner time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

describe('sleepHoursByNight', () => {
  it('puts a whole night on the morning you woke up, across midnight', () => {
    const night = sleepHoursByNight([
      { start: at(21, 23, 0), end: at(22, 0, 30) }, // core, before midnight
      { start: at(22, 0, 30), end: at(22, 3, 0) }, // deep
      { start: at(22, 3, 0), end: at(22, 7, 0) }, // REM/core until waking
    ]);
    expect(night).toEqual([{ date: '2026-09-22', value: 8 }]);
  });

  it('merges overlapping segments from different sources instead of summing them', () => {
    const night = sleepHoursByNight([
      { start: at(21, 23, 0), end: at(22, 7, 0) }, // Apple Watch
      { start: at(21, 23, 30), end: at(22, 6, 30) }, // iPhone
      { start: at(22, 1, 0), end: at(22, 5, 0) }, // third-party app
    ]);
    expect(night).toEqual([{ date: '2026-09-22', value: 8 }]);
  });

  it('keeps an early bedtime with the rest of that night, gap excluded', () => {
    const night = sleepHoursByNight([
      { start: at(21, 21, 0), end: at(21, 23, 30) },
      { start: at(22, 1, 0), end: at(22, 7, 0) },
    ]);
    expect(night).toEqual([{ date: '2026-09-22', value: 8.5 }]);
  });

  it('separates consecutive nights and ignores empty segments', () => {
    const nights = sleepHoursByNight([
      { start: at(22, 23, 0), end: at(23, 6, 0) },
      { start: at(21, 22, 0), end: at(22, 6, 0) },
      { start: at(23, 12, 0), end: at(23, 12, 0) },
    ]);
    expect(nights).toEqual([
      { date: '2026-09-22', value: 8 },
      { date: '2026-09-23', value: 7 },
    ]);
  });
});
