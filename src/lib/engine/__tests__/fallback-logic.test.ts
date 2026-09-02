import { checkFallbackTrigger } from '@/lib/engine/fallback-logic';

describe('checkFallbackTrigger', () => {
  it('returns null when nothing warrants a fallback', () => {
    expect(checkFallbackTrigger(10, 4, false)).toBeNull();
  });

  it('fires "empty-filter" for a genuinely empty pool', () => {
    const result = checkFallbackTrigger(0, 4, false);
    expect(result?.trigger).toBe('empty-filter');
  });

  it('fires "empty-filter" for a single-survivor pool too — the deliberate <=1 divergence from the vault\'s own ===0 rule, which exists specifically because a real 1-exercise pool used to crash M10 uncaught', () => {
    const result = checkFallbackTrigger(1, 4, false);
    expect(result?.trigger).toBe('empty-filter');
  });

  it('fires "energy-1" at the lowest energy score even with a healthy pool', () => {
    const result = checkFallbackTrigger(20, 1, false);
    expect(result?.trigger).toBe('energy-1');
  });

  it('always returns the same two real, always-available recovery exercises', () => {
    const result = checkFallbackTrigger(0, 4, false);
    expect(result?.exercises).toHaveLength(2);
    expect(result?.exercises.map((e) => e.id).sort()).toEqual(['ex_1023', 'ex_1083']);
    expect(result?.isRestDay).toBe(true);
  });

  it('prioritizes empty-filter over energy-1 when both would apply', () => {
    const result = checkFallbackTrigger(0, 1, false);
    expect(result?.trigger).toBe('empty-filter');
  });
});
