/**
 * The pure arithmetic behind Sparkline's date spacing and Donut's shares —
 * kept out of the components so it can be tested without rendering, and so
 * every chart rounds and folds the same way.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// UTC, not local midnight, so a DST change never makes one gap an hour
// longer than the rest.
function dayNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * Each point's x position across `width`, `inset` in from both edges.
 * 'even' puts the points an equal step apart, as Sparkline always has.
 * 'date' spaces them by the days between them, so a two-week break reads as
 * a gap instead of looking like the next day. Falls back to even whenever
 * that can't be honest: a missing or unparseable date, dates out of order,
 * or every point on the same day.
 */
export function sparklineXs(
  dates: (string | undefined)[],
  width: number,
  inset: number,
  spacing: 'even' | 'date'
): number[] {
  const count = dates.length;
  if (count === 0) return [];
  if (count === 1) return [width / 2];
  const span = width - inset * 2;
  if (spacing === 'date') {
    const days = dates.map((date) => (date ? dayNumber(date) : NaN));
    const ordered = days.every((day, i) => Number.isFinite(day) && (i === 0 || day >= days[i - 1]));
    const range = days[count - 1] - days[0];
    if (ordered && range > 0) {
      return days.map((day) => inset + ((day - days[0]) / range) * span);
    }
  }
  const step = span / (count - 1);
  return dates.map((_, i) => inset + i * step);
}

/**
 * Whole-number percentages that always add up to exactly 100 (largest
 * remainder) — plain rounding can show 33% + 33% + 33%, which reads as a
 * mistake on a chart that's only about shares. All zeros in, all zeros out.
 */
export function toPercentShares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, v) / total) * 100);
  const floored = exact.map(Math.floor);
  let remaining = 100 - floored.reduce((sum, v) => sum + v, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, remainder: v - floored[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (remaining <= 0) break;
    floored[i] += 1;
    remaining -= 1;
  }
  return floored;
}

export type ShareItem = { key: string; label: string; value: number };

/**
 * Largest first, keeping at most `maxNamed` items by name and folding the
 * rest into one "Other" — a donut past about six slices can't be read, and
 * a single-hue one even sooner. Never folds a lone leftover (an "Other" of
 * one is just that item with its name hidden). Zero-value items are dropped:
 * nothing done isn't a slice.
 */
export function foldIntoOther(items: ShareItem[], maxNamed: number): (ShareItem & { otherCount?: number })[] {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (sorted.length <= maxNamed + 1) return sorted;
  const named = sorted.slice(0, maxNamed);
  const rest = sorted.slice(maxNamed);
  return [
    ...named,
    { key: 'other', label: 'Other', value: rest.reduce((sum, item) => sum + item.value, 0), otherCount: rest.length },
  ];
}

/** How many check-ins landed on each energy level, 1–5 — Training Load's
 * energy mix. Anything outside 1–5 is ignored rather than guessed into a
 * neighbouring level. */
export function countEnergyLevels(days: { energyScore: number }[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const { energyScore } of days) {
    if (energyScore === 1 || energyScore === 2 || energyScore === 3 || energyScore === 4 || energyScore === 5) {
      counts[energyScore] += 1;
    }
  }
  return counts;
}
