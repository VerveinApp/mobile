import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type SparklinePoint = {
  value: number;
};

type SparklineProps = {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color: string;
  /** Fixes the Y-scale to a known real range (e.g. EnergyScore's 1–5)
   * instead of auto-fitting to just the observed values, which would make a
   * small real fluctuation look like a dramatic swing. Falls back to the
   * data's own min/max when omitted. */
  min?: number;
  max?: number;
  /** "Envelope" style — fills the area under the line with a translucent
   * version of `color`, same solid-stroke-plus-translucent-fill language
   * radar-chart.tsx's own data shape already uses, instead of a bare line. */
  filled?: boolean;
  /** A dashed horizontal marker at a known real value — e.g. a target weight
   * — drawn behind the curve. When min/max are auto-derived (left
   * unspecified), the auto range is widened to include this value so the
   * marker lands naturally in view instead of implying the target is close
   * by clamping it to the nearest edge. */
  referenceValue?: number;
  referenceColor?: string;
};

type Point = { x: number; y: number };

/**
 * Catmull-Rom → cubic Bezier — the standard way to draw a smooth curve
 * that actually passes through every real point, not an approximation that
 * drifts near the data. BUG FIX: a straight-segment polyline was reported
 * hard to read (sharp angles at every point reading as noisy/jagged) and
 * not matching how a trend line reads in other apps — this replaces it
 * everywhere Sparkline is used, not just the one chart it was noticed on.
 * Falls back to a straight line for 2 points (a "curve" through only 2
 * points is just a line anyway — nothing to smooth).
 */
function smoothPathD(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * A minimal curved trend line — hand-rolled on react-native-svg (already a
 * dependency, same library radar-chart.tsx is built on) rather than a new
 * charting dependency, so it stays visually consistent with the rest of
 * this app's chart language instead of importing a generic library's own
 * default look.
 *
 * DEAD CODE REMOVED (found in a later full-app audit): a `muted` per-point
 * flag (dimmer, smaller dot for e.g. a skipped day) and the `mutedColor`
 * prop it needed existed fully wired but were never actually set true by
 * any of the 6 screens using this component. Removed rather than left as
 * unused capability — if a real "this point is different" need comes up
 * again, it's cheap to re-add against a concrete use case.
 */
export function Sparkline({
  data,
  width = 220,
  height = 48,
  color,
  min,
  max,
  filled = false,
  referenceValue,
  referenceColor,
}: SparklineProps) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  let lo = min ?? Math.min(...values);
  let hi = max ?? Math.max(...values);
  if (referenceValue !== undefined) {
    if (min === undefined) lo = Math.min(lo, referenceValue);
    if (max === undefined) hi = Math.max(hi, referenceValue);
  }
  const range = hi - lo || 1;
  // A little vertical inset so a point sitting exactly at min/max isn't
  // clipped by its own stroke/circle radius at the very edge of the canvas.
  const inset = 4;
  const plotHeight = height - inset * 2;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: data.length > 1 ? i * stepX : width / 2,
    y: inset + plotHeight - ((d.value - lo) / range) * plotHeight,
  }));
  const linePath = smoothPathD(points);
  // Closes the same curve into a filled shape by dropping straight down to
  // the baseline at each end — the same "solid stroke, translucent fill"
  // envelope look radar-chart.tsx's own data polygon already uses.
  const areaPath =
    points.length > 1 ? `${linePath} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z` : '';
  const referenceY =
    referenceValue !== undefined
      ? Math.max(inset, Math.min(height - inset, inset + plotHeight - ((referenceValue - lo) / range) * plotHeight))
      : null;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {referenceY !== null ? (
          <Line
            x1={0}
            y1={referenceY}
            x2={width}
            y2={referenceY}
            stroke={referenceColor ?? color}
            strokeWidth={1}
            strokeDasharray="3,3"
            opacity={0.5}
          />
        ) : null}
        {filled && areaPath ? <Path d={areaPath} fill={color} fillOpacity={0.18} stroke="none" /> : null}
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
        ))}
      </Svg>
    </View>
  );
}
