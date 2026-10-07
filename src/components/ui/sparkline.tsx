import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import ReanimatedAnimated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { hapticSelect } from '@/lib/haptics';

/** How long a finger rests on a chart before it starts scrubbing — long
 * enough that a vertical swipe across the chart still just scrolls. */
const SCRUB_HOLD_MS = 180;

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);
const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

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
  /** Extra wait before the draw-in, in ms — lets a stack of charts trace in
   * one after another instead of all at once. */
  delay?: number;
  /** Holds the draw-in until true — for a chart that mounts below the fold,
   * so it traces in when it's scrolled to rather than unseen at mount. */
  play?: boolean;
  /** Turns on touch-and-hold scrubbing: a hairline and a dot follow the
   * finger, a selection tick marks each point crossed, and this reports the
   * point under the finger (null on release) so the card can show that
   * point's value in its own heading — the chart itself stays label-free. */
  onScrub?: (index: number | null) => void;
};

type Point = { x: number; y: number };

// Room left around the plotted points for the biggest mark drawn on one —
// the scrub dot's radius. BUG FIX: the points used to run edge to edge, so
// the newest point's dot (always at the right edge) and both round line
// caps were cut in half by the Svg's own bounds.
const EDGE_INSET = 4.5;

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
 *
 * Draws itself in once, the first time it appears — the line traced left
 * to right, the fill and the latest point fading in behind it — on the same
 * curve and timing radar-chart.tsx's bloom uses, so every chart in the app
 * arrives the same way instead of the radar alone animating. Later data
 * updates re-render in place without replaying it. Instant under Reduce
 * Motion. Only the LATEST point gets a dot now: a dot on every point
 * crowded any history longer than a handful of entries, and the newest
 * value is the one a trend line is read toward.
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
  delay = 0,
  play = true,
  onScrub,
}: SparklineProps) {
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      reveal.value = 1;
      return;
    }
    if (!play) return;
    reveal.value = withDelay(150 + delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [reveal, reducedMotion, delay, play]);

  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastScrubIndex = useSharedValue(-1);
  const pointCount = data.length;
  const stepX = pointCount > 1 ? (width - EDGE_INSET * 2) / (pointCount - 1) : 0;
  const reportScrub = (index: number | null) => {
    setScrubIndex(index);
    if (index !== null) hapticSelect();
    onScrub?.(index);
  };
  // A chart that goes away mid-scrub (its card hides, the list reloads)
  // never sees its gesture finish — release the card anyway, or a parent
  // that locks scrolling while scrubbing would stay locked.
  const releaseScrubOnUnmount = useEffectEvent(() => {
    if (lastScrubIndex.value !== -1) onScrub?.(null);
  });
  useEffect(() => () => releaseScrubOnUnmount(), []);
  const scrubGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(onScrub !== undefined && pointCount > 1)
        .activateAfterLongPress(SCRUB_HOLD_MS)
        .onStart((e) => {
          const index = Math.max(0, Math.min(pointCount - 1, Math.round((e.x - EDGE_INSET) / stepX)));
          lastScrubIndex.value = index;
          scheduleOnRN(reportScrub, index);
        })
        .onUpdate((e) => {
          const index = Math.max(0, Math.min(pointCount - 1, Math.round((e.x - EDGE_INSET) / stepX)));
          if (index === lastScrubIndex.value) return;
          lastScrubIndex.value = index;
          scheduleOnRN(reportScrub, index);
        })
        .onFinalize(() => {
          if (lastScrubIndex.value === -1) return;
          lastScrubIndex.value = -1;
          scheduleOnRN(reportScrub, null);
        }),
    // reportScrub closes over onScrub; a new chart identity rebuilds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onScrub, pointCount, stepX]
  );

  const values = data.map((d) => d.value);
  let lo = min ?? Math.min(...values);
  let hi = max ?? Math.max(...values);
  if (referenceValue !== undefined) {
    if (min === undefined) lo = Math.min(lo, referenceValue);
    if (max === undefined) hi = Math.max(hi, referenceValue);
  }
  const range = hi - lo || 1;
  // The same inset vertically, so a point sitting exactly at min/max isn't
  // clipped by its own stroke/circle radius at the very edge of the canvas.
  const inset = EDGE_INSET;
  const plotHeight = height - inset * 2;

  const points = data.map((d, i) => ({
    x: data.length > 1 ? EDGE_INSET + i * stepX : width / 2,
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
  // Straight-line length between the points, padded for the curve's extra
  // arc — only needs to be at least the real length for the dash trick.
  let lineLength = 1;
  for (let i = 1; i < points.length; i++) {
    lineLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  lineLength *= 1.15;
  const lastPoint = points[points.length - 1];

  const lineAnimatedProps = useAnimatedProps(() => ({ strokeDashoffset: lineLength * (1 - reveal.value) }));
  const areaAnimatedProps = useAnimatedProps(() => ({ fillOpacity: 0.18 * reveal.value }));
  const dotAnimatedProps = useAnimatedProps(() => ({ opacity: Math.max(0, (reveal.value - 0.8) / 0.2) }));

  if (data.length === 0) return null;

  const scrubPoint = scrubIndex !== null ? points[scrubIndex] : null;

  return (
    <GestureDetector gesture={scrubGesture}>
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
          {filled && areaPath ? (
            <AnimatedPath d={areaPath} fill={color} stroke="none" animatedProps={areaAnimatedProps} />
          ) : null}
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={lineLength}
            animatedProps={lineAnimatedProps}
          />
          <AnimatedCircle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={color} animatedProps={dotAnimatedProps} />
          {scrubPoint ? (
            <>
              <Line x1={scrubPoint.x} y1={0} x2={scrubPoint.x} y2={height} stroke={color} strokeOpacity={0.35} strokeWidth={1} />
              <Circle cx={scrubPoint.x} cy={scrubPoint.y} r={4.5} fill={color} />
            </>
          ) : null}
        </Svg>
      </View>
    </GestureDetector>
  );
}
