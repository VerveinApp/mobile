import { buildExplanation, TAG_LINES } from '@/lib/engine/explanation-string';
import type { UserCalibration } from '@/lib/engine/types';

const NEUTRAL_CALIBRATION: UserCalibration = { userId: 'test-user', multiplier: 1.0, sampleCount: 0 };

describe('buildExplanation', () => {
  it('uses the real energy-specific base template, interpolating duration/pct at Energy 2', () => {
    const { explanation } = buildExplanation(2, [], NEUTRAL_CALIBRATION, 24, 70);
    expect(explanation).toContain('24 min');
    expect(explanation).toContain('70%');
  });

  it('every energy score 1–5 produces a non-empty base sentence with no active tags or calibration', () => {
    for (const energy of [1, 2, 3, 4, 5] as const) {
      const { explanation, explanationMapping } = buildExplanation(energy, [], NEUTRAL_CALIBRATION, 30, 100);
      expect(explanation.length).toBeGreaterThan(0);
      expect(explanationMapping).toEqual([{ reduction: `energy=${energy}`, template: explanation }]);
    }
  });

  it('appends a real tag line for every canonical symptom tag, in order', () => {
    const { explanation, explanationMapping } = buildExplanation(3, ['period', 'nausea'], NEUTRAL_CALIBRATION, 30, 100);
    expect(explanation).toContain(TAG_LINES.period);
    expect(explanation).toContain(TAG_LINES.nausea);
    expect(explanation.indexOf(TAG_LINES.period)).toBeLessThan(explanation.indexOf(TAG_LINES.nausea));
    expect(explanationMapping).toContainEqual({ reduction: 'symptom:period', template: TAG_LINES.period });
    expect(explanationMapping).toContainEqual({ reduction: 'symptom:nausea', template: TAG_LINES.nausea });
  });

  it('throws for a tag Gate 1 (M5) should never have let through — REGRESSION GUARD: a silent fallback would ship a workout with real constraint effects but no matching "why" text', () => {
    expect(() => buildExplanation(3, ['not_a_real_tag'], NEUTRAL_CALIBRATION, 30, 100)).toThrow(/unrecognized symptom tag/);
  });

  it('adds no calibration line at the neutral default (sampleCount 0, multiplier 1.0)', () => {
    const { explanation, explanationMapping } = buildExplanation(3, [], NEUTRAL_CALIBRATION, 30, 100);
    expect(explanationMapping).toHaveLength(1);
    expect(explanation).not.toMatch(/feedback/i);
  });

  it('adds an "up" calibration line when the multiplier has moved above 1.0', () => {
    const calibration: UserCalibration = { userId: 'test-user', multiplier: 1.1, sampleCount: 5 };
    const { explanation, explanationMapping } = buildExplanation(3, [], calibration, 30, 100);
    expect(explanation).toContain('nudged up');
    expect(explanationMapping).toContainEqual({ reduction: 'calibration', template: expect.stringContaining('nudged up') });
  });

  it('adds a "down" calibration line when the multiplier has moved below 1.0', () => {
    const calibration: UserCalibration = { userId: 'test-user', multiplier: 0.9, sampleCount: 5 };
    const { explanation } = buildExplanation(3, [], calibration, 30, 100);
    expect(explanation).toContain('eased back');
  });

  it('omits the calibration line at exactly 1.0 even with real sampleCount history — a multiplier that happens to land back on neutral has nothing distinct to report', () => {
    const calibration: UserCalibration = { userId: 'test-user', multiplier: 1.0, sampleCount: 20 };
    const { explanation } = buildExplanation(3, [], calibration, 30, 100);
    expect(explanation).not.toMatch(/feedback/i);
  });

  it('joins base sentence, tag lines, and calibration line in that fixed order', () => {
    const calibration: UserCalibration = { userId: 'test-user', multiplier: 1.1, sampleCount: 5 };
    const { explanation } = buildExplanation(4, ['stressed'], calibration, 30, 100);
    const baseIdx = explanation.indexOf('Feeling good');
    const tagIdx = explanation.indexOf(TAG_LINES.stressed);
    const calIdx = explanation.indexOf('nudged up');
    expect(baseIdx).toBeLessThan(tagIdx);
    expect(tagIdx).toBeLessThan(calIdx);
  });
});
