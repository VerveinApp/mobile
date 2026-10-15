import { useEffect } from 'react';
import { View } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

export type DonutSlice = { key: string; value: number; color: string };

// A hairline of track between slices, so neighbouring shades stay distinct.
const GAP_DEGREES = 2.5;

/**
 * A ring of shares — what a breakdown is made of, never progress toward a
 * target (there is no "full" ring to fall short of). Draws in clockwise from
 * the top once `play` is true; under Reduce Motion it appears whole. Values
 * are raw counts; zero slices are skipped.
 */
export function Donut({
  slices,
  size = 88,
  thickness = 12,
  trackColor,
  play = true,
  accessibilityLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  trackColor: string;
  play?: boolean;
  accessibilityLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      reveal.set(1);
      return;
    }
    if (!play) return;
    reveal.set(withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [reveal, reducedMotion, play]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);
  const gap = visible.length > 1 ? (GAP_DEGREES / 360) * circumference : 0;

  let offset = 0;
  const arcs = visible.map((slice) => {
    const length = (slice.value / total) * circumference;
    const arc = { key: slice.key, color: slice.color, start: offset, length: Math.max(0, length - gap) };
    offset += length;
    return arc;
  });

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={thickness} fill="none" />
          {total > 0
            ? arcs.map((arc) => (
                <DonutArc
                  key={arc.key}
                  size={size}
                  radius={radius}
                  thickness={thickness}
                  circumference={circumference}
                  color={arc.color}
                  start={arc.start}
                  length={arc.length}
                  reveal={reveal}
                />
              ))
            : null}
        </G>
      </Svg>
    </View>
  );
}

function DonutArc({
  size,
  radius,
  thickness,
  circumference,
  color,
  start,
  length,
  reveal,
}: {
  size: number;
  radius: number;
  thickness: number;
  circumference: number;
  color: string;
  start: number;
  length: number;
  reveal: ReturnType<typeof useSharedValue<number>>;
}) {
  // Each arc grows as the sweep passes its start, so the ring fills in one
  // continuous motion rather than every slice growing at once.
  const animatedProps = useAnimatedProps(() => {
    const swept = reveal.get() * circumference;
    const shown = Math.max(0, Math.min(length, swept - start));
    return { strokeDasharray: [shown, circumference] };
  });
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke={color}
      strokeWidth={thickness}
      strokeDashoffset={-start}
      animatedProps={animatedProps}
      fill="none"
    />
  );
}
