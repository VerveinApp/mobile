import { computeUpdatedCalibration, DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { UserCalibration } from '@/lib/engine/types';

function makeCalibration(overrides: Partial<UserCalibration> = {}): UserCalibration {
  return { userId: 'test-user', ...DEFAULT_CALIBRATION, ...overrides };
}

describe('computeUpdatedCalibration', () => {
  it('"too_easy" increases the multiplier', () => {
    const result = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'too_easy');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('"too_hard" decreases the multiplier', () => {
    const result = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'too_hard');
    expect(result.multiplier).toBeLessThan(1.0);
  });

  it('"just_right" leaves the multiplier unchanged', () => {
    const result = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'just_right');
    expect(result.multiplier).toBe(1.0);
  });

  it('always increments sampleCount by exactly 1, regardless of feedback', () => {
    const result = computeUpdatedCalibration(makeCalibration({ sampleCount: 7 }), 'just_right');
    expect(result.sampleCount).toBe(8);
  });

  it('preserves userId', () => {
    const result = computeUpdatedCalibration(makeCalibration({ userId: 'alice' }), 'too_easy');
    expect(result.userId).toBe('alice');
  });

  it('never exceeds the hard ceiling of 1.4, even after many consecutive "too_easy" responses', () => {
    let calibration = makeCalibration({ multiplier: 1.39, sampleCount: 50 });
    for (let i = 0; i < 20; i++) {
      calibration = computeUpdatedCalibration(calibration, 'too_easy');
    }
    expect(calibration.multiplier).toBeLessThanOrEqual(1.4);
  });

  it('never drops below the hard floor of 0.5, even after many consecutive "too_hard" responses', () => {
    let calibration = makeCalibration({ multiplier: 0.51, sampleCount: 50 });
    for (let i = 0; i < 20; i++) {
      calibration = computeUpdatedCalibration(calibration, 'too_hard');
    }
    expect(calibration.multiplier).toBeGreaterThanOrEqual(0.5);
  });

  it('"much_too_easy" increases the multiplier more than "too_easy" — the two are meant to be distinguishable, not aliases', () => {
    const muchTooEasy = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'much_too_easy');
    const tooEasy = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'too_easy');
    expect(muchTooEasy.multiplier).toBeGreaterThan(tooEasy.multiplier);
  });

  it('"much_too_hard" decreases the multiplier more than "too_hard"', () => {
    const muchTooHard = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'much_too_hard');
    const tooHard = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0 }), 'too_hard');
    expect(muchTooHard.multiplier).toBeLessThan(tooHard.multiplier);
  });

  it('"much_too_easy" moves the multiplier by exactly double "too_easy"\'s delta — REGRESSION GUARD: the outer values are 2x a notch, not a separately invented magnitude, so a single "much_too_easy" always matches the old pre-widening fixed step exactly', () => {
    const base = makeCalibration({ multiplier: 1.0, sampleCount: 0 });
    const tooEasyDelta = computeUpdatedCalibration(base, 'too_easy').multiplier - 1.0;
    const muchTooEasyDelta = computeUpdatedCalibration(base, 'much_too_easy').multiplier - 1.0;
    expect(muchTooEasyDelta).toBeCloseTo(tooEasyDelta * 2, 10);
  });

  it('dampens the step size as sampleCount grows — an early sample moves the multiplier more than a late one', () => {
    const early = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0, sampleCount: 0 }), 'too_easy');
    const late = computeUpdatedCalibration(makeCalibration({ multiplier: 1.0, sampleCount: 99 }), 'too_easy');
    const earlyDelta = early.multiplier - 1.0;
    const lateDelta = late.multiplier - 1.0;
    expect(earlyDelta).toBeGreaterThan(lateDelta);
    expect(lateDelta).toBeGreaterThan(0); // still a real, non-zero nudge, just a smaller one
  });
});
