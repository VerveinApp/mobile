import { trialReminderTime } from '@/lib/trial-reminder';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const ends = (iso: string) => ({ periodType: 'TRIAL', willRenew: true, expirationDate: iso });

describe('trialReminderTime', () => {
  it('fires a day before a trial that will convert', () => {
    expect(trialReminderTime(ends('2026-10-17T12:00:00Z'), NOW)).toBe(Date.parse('2026-10-16T12:00:00Z'));
  });

  it('never fires for a cancelled trial, a promotional week, or a paid period', () => {
    expect(trialReminderTime({ ...ends('2026-10-17T12:00:00Z'), willRenew: false }, NOW)).toBeNull();
    expect(trialReminderTime({ ...ends('2026-10-17T12:00:00Z'), periodType: 'PROMOTIONAL' }, NOW)).toBeNull();
    expect(trialReminderTime({ ...ends('2026-10-17T12:00:00Z'), periodType: 'NORMAL' }, NOW)).toBeNull();
    expect(trialReminderTime(undefined, NOW)).toBeNull();
  });

  it('skips a day-before moment that has already passed', () => {
    expect(trialReminderTime(ends('2026-10-15T06:00:00Z'), NOW)).toBeNull();
  });
});
