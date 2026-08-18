import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
        const [x, y] = polarPoint(cx, cy, radius + 22, axisAngle(i, count));
        return (
          <ReanimatedAnimated.View
            key={d.label}
            entering={reducedMotion ? undefined : FadeIn.duration(300).delay(120 * i)}
            pointerEvents="none"
            style={[styles.axisLabelWrap, { left: x - 34, top: y - 8, width: 68 }]}
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
