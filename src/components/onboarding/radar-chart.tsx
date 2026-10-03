import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Type } from '@/constants/theme';
import { MOTION_DURATION } from '@/lib/motion';
import { useAppColors } from '@/lib/theme-context';
import ReanimatedAnimated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);
const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

export type RadarDatum = {
  label: string;
  value: number;
};

type RadarChartProps = {
  data: RadarDatum[];
  size?: number;
  maxValue?: number;
  /** Holds the bloom until true — for a chart that mounts below the fold. */
  play?: boolean;
};

const RING_FRACTIONS = [0.34, 0.67, 1];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (Math.PI / 180) * angleDeg;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function axisAngle(index: number, count: number): number {
  return -90 + index * (360 / count);
}

function pointsToString(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Where axis `index` sits mid-morph — `from` eased toward `to` by `t`. */
function morphedFraction(from: number[], to: number[], t: number, index: number): number {
  'worklet';
  return from[index] + (to[index] - from[index]) * t;
}

/**
 * A 5-axis (or N-axis) radar/spider chart — the visual centerpiece of the
 * estimated-potential screen. The data shape (polygon + dots) blooms out
 * from the center on mount rather than appearing instantly: it's rendered
 * as its own same-size overlay layer scaled/faded in from its natural
 * center, which lands exactly on the chart's own center (cx, cy) — so every
 * point grows outward along its real radial line, not just a generic pop.
 * The grid (rings/spokes/labels) stays static — only the data reads as "new".
 *
 * New values for the same axes (Progress's Last 7 Days ↔ All toggle) don't
 * replay that bloom: the shape eases from wherever it currently is to the
 * new values, each point sliding along its own axis, so the change itself
 * is what's visible. A different axis set is a different chart, and blooms
 * in fresh.
 *
 * Deliberately single-layer only. A second "current progress" layer nested
 * inside this one was tried and reverted — even framed as "observation, not
 * score," an outer shape a smaller one sits inside of reads as a target the
 * user is falling short of, no matter the label. See training-radar.tsx for
 * the honest alternative: a self-normalized shape with no implied ceiling.
 */
export function RadarChart({ data, size = 220, maxValue = 100, play = true }: RadarChartProps) {
  const colors = useAppColors();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34; // leaves room for axis labels around the edge
  const count = data.length;
  const reducedMotion = useReducedMotion();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {RING_FRACTIONS.map((fraction) => (
          <Polygon
            key={fraction}
            points={pointsToString(
              Array.from({ length: count }, (_, i) => polarPoint(cx, cy, radius * fraction, axisAngle(i, count)))
            )}
            fill="none"
            stroke={colors.surfaceBorder}
            strokeWidth={1}
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = polarPoint(cx, cy, radius, axisAngle(i, count));
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.surfaceBorder} strokeWidth={1} />;
        })}
      </Svg>

      <RadarDataLayer
        key={data.map((d) => d.label).join('|')}
        fractions={data.map((d) => Math.max(0, Math.min(1, d.value / maxValue)))}
        size={size}
        radius={radius}
        play={play}
      />

      {data.map((d, i) => {
        const angle = axisAngle(i, count);
        const [x, y] = polarPoint(cx, cy, radius + 22, angle);
        const labelWidth = 68;
        // BUG FIX: centering the label box on its axis point put HALF the
        // text on the chart-ward side of that point — fine for a diagonal
        // axis (the 5-axis onboarding usage this was tuned against: angles
        // -90/-18/54/126/198, none horizontal), but for a left/right axis
        // (Progress's 4-axis usage) the chart-ward half of the box lands
        // right on top of the data dot whenever that axis's value is near
        // its max, since the label's radial offset (+22) is only a little
        // past the dot's own outer-ring position. An earlier fix clamped
        // the box to the canvas edge, which incidentally pulled it EVEN
        // closer to the dot on that exact axis — same overlap, different
        // cause. The real fix is anchoring by direction: a strongly
        // left/right axis extends its label AWAY from center (past the
        // point, never back over it); every other axis still centers, since
        // there both halves point safely off to the sides of the chart, not
        // back into it.
        //
        // BUG FIX (found in a later full-app audit): 0.5 as a threshold was
        // far too loose — it catches any axis within 60° of horizontal, which
        // swept up the 5-axis onboarding chart's diagonal axes too (cos ±0.588
        // and ±0.951, comfortably over 0.5) even though the comment above
        // claims that chart is untouched. Those got incorrectly re-anchored,
        // making at least one label's overflow worse than before this fix
        // existed. 0.99 leaves only an axis that's genuinely horizontal
        // (cos exactly ±1 at 0°/180°, e.g. Progress's 4-axis chart) anchored;
        // every diagonal axis, on any N-axis chart, still centers.
        const cosAngle = Math.cos((Math.PI / 180) * angle);
        const left =
          cosAngle > 0.99
            ? x
            : cosAngle < -0.99
              ? x - labelWidth
              : x - labelWidth / 2;
        return (
          <ReanimatedAnimated.View
            key={d.label}
            entering={reducedMotion ? undefined : FadeIn.duration(MOTION_DURATION.slow).delay(120 * i)}
            pointerEvents="none"
            style={[styles.axisLabelWrap, { left, top: y - 8, width: labelWidth }]}
          >
            <Text style={[styles.axisLabel, { color: colors.textTertiary }]} maxFontSizeMultiplier={1.15}>
              {d.label}
            </Text>
          </ReanimatedAnimated.View>
        );
      })}
    </View>
  );
}

type RadarDataLayerProps = {
  fractions: number[];
  size: number;
  radius: number;
  play: boolean;
};

/**
 * The data shape (fill, outline, dots) for one fixed set of axes. Keyed on
 * the axis labels by RadarChart, so a new axis set remounts it and blooms
 * fresh, while new values for the same axes morph in place.
 */
function RadarDataLayer({ fractions, size, radius, play }: RadarDataLayerProps) {
  const cx = size / 2;
  const cy = size / 2;
  const count = fractions.length;
  const angles = fractions.map((_, i) => (Math.PI / 180) * axisAngle(i, count));

  const reducedMotion = useReducedMotion();
  const bloom = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      bloom.value = 1;
      return;
    }
    if (!play) return;
    bloom.value = withDelay(200, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
  }, [bloom, reducedMotion, play]);

  const dataLayerStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: 0.35 + bloom.value * 0.65 }],
  }));

  // The shape on screen is always `from` eased toward `to` by `morph`. A new
  // set of values restarts the ease from wherever the shape is right now —
  // read on the UI thread, so a quick second toggle mid-morph turns around
  // smoothly instead of jumping back to the last resting shape first.
  const from = useSharedValue(fractions);
  const to = useSharedValue(fractions);
  const morph = useSharedValue(1);
  const fractionsKey = fractions.join(',');
  useEffect(() => {
    const next = fractionsKey.split(',').map(Number);
    if (reducedMotion) {
      from.value = next;
      to.value = next;
      morph.value = 1;
      return;
    }
    scheduleOnUI(() => {
      'worklet';
      if (next.every((value, i) => value === to.value[i])) return;
      from.value = to.value.map((_, i) => morphedFraction(from.value, to.value, morph.value, i));
      to.value = next;
      morph.value = 0;
      morph.value = withTiming(1, { duration: MOTION_DURATION.slow, easing: Easing.out(Easing.cubic) });
    });
  }, [fractionsKey, reducedMotion, from, to, morph]);

  const shapeProps = useAnimatedProps(() => {
    let d = '';
    for (let i = 0; i < count; i++) {
      const r = radius * morphedFraction(from.value, to.value, morph.value, i);
      d += `${i === 0 ? 'M' : ' L'} ${cx + r * Math.cos(angles[i])},${cy + r * Math.sin(angles[i])}`;
    }
    return { d: `${d} Z` };
  });

  return (
    <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, dataLayerStyle]}>
      <Svg width={size} height={size}>
        <AnimatedPath animatedProps={shapeProps} fill="rgba(67,140,99,0.28)" stroke="#438C63" strokeWidth={2} />
        {angles.map((angle, i) => (
          <RadarDot key={i} index={i} angle={angle} cx={cx} cy={cy} radius={radius} from={from} to={to} morph={morph} />
        ))}
      </Svg>
    </ReanimatedAnimated.View>
  );
}

type RadarDotProps = {
  index: number;
  angle: number;
  cx: number;
  cy: number;
  radius: number;
  from: SharedValue<number[]>;
  to: SharedValue<number[]>;
  morph: SharedValue<number>;
};

function RadarDot({ index, angle, cx, cy, radius, from, to, morph }: RadarDotProps) {
  const dotProps = useAnimatedProps(() => {
    const r = radius * morphedFraction(from.value, to.value, morph.value, index);
    return { cx: cx + r * Math.cos(angle), cy: cy + r * Math.sin(angle) };
  });
  return <AnimatedCircle animatedProps={dotProps} r={3.5} fill="#438C63" />;
}

const styles = StyleSheet.create({
  axisLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  // Was 9pt — below the smallest size used anywhere else in the app and hard
  // to read at a glance on a phone. Type.micro is the app's own floor.
  axisLabel: {
    fontSize: Type.micro,
    fontFamily: 'Geist-Medium',
    textAlign: 'center',
  },
});
