import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MOTION_DURATION } from '@/lib/motion';
import { useAppColors } from '@/lib/theme-context';
import ReanimatedAnimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

export type RadarDatum = {
  label: string;
  value: number;
};

type RadarChartProps = {
  data: RadarDatum[];
  size?: number;
  maxValue?: number;
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

/**
 * A 5-axis (or N-axis) radar/spider chart — the visual centerpiece of the
 * estimated-potential screen. The data shape (polygon + dots) blooms out
 * from the center on mount rather than appearing instantly: it's rendered
 * as its own same-size overlay layer scaled/faded in from its natural
 * center, which lands exactly on the chart's own center (cx, cy) — so every
 * point grows outward along its real radial line, not just a generic pop.
 * The grid (rings/spokes/labels) stays static — only the data reads as "new".
 *
 * Deliberately single-layer only. A second "current progress" layer nested
 * inside this one was tried and reverted — even framed as "observation, not
 * score," an outer shape a smaller one sits inside of reads as a target the
 * user is falling short of, no matter the label. See training-radar.tsx for
 * the honest alternative: a self-normalized shape with no implied ceiling.
 */
export function RadarChart({ data, size = 220, maxValue = 100 }: RadarChartProps) {
  const colors = useAppColors();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34; // leaves room for axis labels around the edge
  const count = data.length;

  const dataPoints = data.map((d, i) =>
    polarPoint(cx, cy, radius * Math.max(0, Math.min(1, d.value / maxValue)), axisAngle(i, count))
  );

  const reducedMotion = useReducedMotion();
  const bloom = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    bloom.value = withDelay(200, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
  }, [bloom, reducedMotion]);

  const dataLayerStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: 0.35 + bloom.value * 0.65 }],
  }));

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

      <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, dataLayerStyle]}>
        <Svg width={size} height={size}>
          <Polygon points={pointsToString(dataPoints)} fill="rgba(67,140,99,0.28)" stroke="#438C63" strokeWidth={2} />
          {dataPoints.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={3.5} fill="#438C63" />
          ))}
        </Svg>
      </ReanimatedAnimated.View>

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

const styles = StyleSheet.create({
  axisLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 9,
    fontFamily: 'Geist-Medium',
    textAlign: 'center',
  },
});
