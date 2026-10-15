import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { useCanvasUnit } from '@/lib/canvas-scale';

const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

/**
 * The draining ring around the session clock, readable from across a room.
 * `fraction` is the share of the interval still to go; while the clock runs
 * the ring glides toward where the next second lands, so it moves smoothly
 * between ticks instead of stepping once a second. Under Reduce Motion it
 * steps with the clock. Sizes are canvas units (it lives inside
 * check-in.tsx's fixed canvas).
 */
export function TimerRing({
  fraction,
  running,
  color,
  trackColor,
  size,
  strokeWidth,
  setsDone,
  totalSets,
  dotColor,
  children,
}: {
  fraction: number;
  /** True while the clock is counting — the ring then eases over the second. */
  running: boolean;
  color: string;
  trackColor: string;
  size: number;
  strokeWidth: number;
  /** Dots under the clock, one per set — only when the set count is real. */
  setsDone?: number;
  totalSets?: number;
  dotColor?: string;
  children: ReactNode;
}) {
  const unit = useCanvasUnit();
  const reducedMotion = useReducedMotion();
  const drawn = size * unit;
  const stroke = strokeWidth * unit;
  const radius = (drawn - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));

  // Mutated before useAnimatedProps reads it — the same source order the
  // clock pulse in check-in.tsx keeps for the React Compiler's check.
  const progress = useSharedValue(clamped);
  useEffect(() => {
    progress.set(
      reducedMotion
        ? clamped
        : withTiming(clamped, { duration: running ? 1000 : 200, easing: running ? Easing.linear : Easing.out(Easing.quad) })
    );
  }, [clamped, running, reducedMotion, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));

  const showDots = totalSets !== undefined && totalSets > 1 && totalSets <= 12;

  return (
    <View style={{ width: drawn, height: drawn }}>
      <Svg width={drawn} height={drawn} pointerEvents="none">
        <G rotation={-90} origin={`${drawn / 2}, ${drawn / 2}`}>
          <Circle cx={drawn / 2} cy={drawn / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={drawn / 2}
            cy={drawn / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="box-none">
        {children}
        {showDots ? (
          <View
            style={[styles.dots, { gap: 6 * unit, marginTop: 8 * unit }]}
            accessible
            accessibilityLabel={`${setsDone ?? 0} of ${totalSets} sets done`}
          >
            {Array.from({ length: totalSets }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 6 * unit,
                  height: 6 * unit,
                  borderRadius: 3 * unit,
                  backgroundColor: i < (setsDone ?? 0) ? (dotColor ?? color) : trackColor,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
  },
});
