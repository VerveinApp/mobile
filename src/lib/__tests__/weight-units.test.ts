import {
  displayWeightToKg,
  formatWeight,
  formatWeightNumber,
  kgToDisplayWeight,
  parseDecimalInput,
  weightUnitLabel,
} from '@/lib/weight-units';

describe('weight-units', () => {
  it('labels each unit system', () => {
    expect(weightUnitLabel('metric')).toBe('kg');
    expect(weightUnitLabel('imperial')).toBe('lb');
  });

  it('round-trips a pound entry through kg storage without drift', () => {
    const storedKg = displayWeightToKg(135, 'imperial');
    expect(formatWeight(storedKg, 'imperial')).toBe('135 lb');
    expect(kgToDisplayWeight(storedKg, 'imperial')).toBeCloseTo(135, 6);
  });

  it('passes metric values through unchanged', () => {
    expect(displayWeightToKg(60, 'metric')).toBe(60);
    expect(formatWeight(52.5, 'metric')).toBe('52.5 kg');
  });

  it('formats with at most one decimal and no trailing .0', () => {
    expect(formatWeightNumber(100)).toBe('100');
    expect(formatWeightNumber(61.2349)).toBe('61.2');
    expect(formatWeightNumber(59.96)).toBe('60');
  });

  describe('parseDecimalInput', () => {
    it('accepts a dot or a comma as the decimal separator', () => {
      expect(parseDecimalInput('72.5')).toBe(72.5);
      expect(parseDecimalInput('72,5')).toBe(72.5);
      expect(parseDecimalInput(' 135 ')).toBe(135);
      expect(parseDecimalInput('.5')).toBe(0.5);
    });

    it('rejects anything that is not a plain number', () => {
      expect(parseDecimalInput('')).toBeNull();
      expect(parseDecimalInput('.')).toBeNull();
      expect(parseDecimalInput('1.2.3')).toBeNull();
      expect(parseDecimalInput('1,2,3')).toBeNull();
      expect(parseDecimalInput('abc')).toBeNull();
      expect(parseDecimalInput('-5')).toBeNull();
    });
  });
});
