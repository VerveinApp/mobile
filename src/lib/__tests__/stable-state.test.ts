import { unlessUnchanged } from '@/lib/stable-state';

describe('unlessUnchanged', () => {
  it('keeps the current object when the reloaded one has the same content', () => {
    const prev = { name: 'Sam', days: ['monday', 'thursday'], weightKg: 64 };
    const next = { name: 'Sam', days: ['monday', 'thursday'], weightKg: 64 };
    expect(unlessUnchanged(next)(prev)).toBe(prev);
  });

  it('takes the reloaded object when anything in it changed, however deep', () => {
    const prev = { rollingWindow: { days: [{ date: '2026-09-22', energyScore: 3 }] } };
    const next = { rollingWindow: { days: [{ date: '2026-09-22', energyScore: 4 }] } };
    expect(unlessUnchanged(next)(prev)).toBe(next);
  });

  it('handles null and undefined on either side', () => {
    const value = { energy: 4 };
    expect(unlessUnchanged<typeof value | null>(null)(null)).toBeNull();
    expect(unlessUnchanged<typeof value | null>(value)(null)).toBe(value);
    expect(unlessUnchanged<typeof value | null>(null)(value)).toBeNull();
    expect(unlessUnchanged<typeof value | undefined>(undefined)(value)).toBeUndefined();
    expect(unlessUnchanged<typeof value | undefined>(value)(undefined)).toBe(value);
  });

  it('keeps an equal array, so list state stays referentially stable', () => {
    const prev = [{ value: 70 }, { value: 69.5 }];
    expect(unlessUnchanged([{ value: 70 }, { value: 69.5 }])(prev)).toBe(prev);
    expect(unlessUnchanged([{ value: 70 }])(prev)).not.toBe(prev);
  });
});
