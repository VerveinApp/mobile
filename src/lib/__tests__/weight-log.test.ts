import { resolveCurrentWeightKg, type WeightLogEntry } from '@/lib/weight-log';

describe('resolveCurrentWeightKg', () => {
  it('prefers the latest logged entry over the profile value', () => {
    const log: WeightLogEntry[] = [{ date: '2026-09-01', weightKg: 72 }];
    expect(resolveCurrentWeightKg(log, '68')).toBe(72);
  });

  it('falls back to the profile value when nothing is logged', () => {
    expect(resolveCurrentWeightKg([], '68')).toBe(68);
  });

  it('returns null when neither a logged entry nor a profile value exists', () => {
    expect(resolveCurrentWeightKg([], undefined)).toBeNull();
  });
});
