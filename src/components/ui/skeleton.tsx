import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppColors } from '@/lib/theme-context';

type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
};

/**
 * A single pulsing placeholder rectangle — the building block for every
 * loading skeleton in the app. Pulses opacity (not a sliding shimmer bar)
 * since that reads cleanly at small sizes and costs nothing extra to
 * compose into row/card layouts. Reduced-motion users get a static, slightly
 * dimmed block instead of the pulse.
 */
export function SkeletonBlock({ width = '100%', height = 14, borderRadius = 6, style }: SkeletonBlockProps) {
  const colors = useAppColors();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(reducedMotion ? 0.6 : 0.4);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <ReanimatedAnimated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.pillBg },
        animatedStyle,
        style,
      ]}
    />
  );
}

const LINE_WIDTHS: DimensionValue[] = ['55%', '80%', '65%', '90%', '50%'];

/**
 * A skeleton shaped like a bordered card — same radius/border language as the
 * real cards it stands in for. `lines` controls how many placeholder rows it
 * stacks, so taller cards (radar/potential, multi-row lists) can look
 * proportionally filled instead of mostly empty white space.
 */
export function SkeletonCard({ height = 80, lines = 2, style }: { height?: number; lines?: number; style?: object }) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.card,
        { height, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
        style,
      ]}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          width={LINE_WIDTHS[index % LINE_WIDTHS.length]}
          height={index === 0 ? 12 : 14}
          style={index > 0 ? { marginTop: 12 } : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    justifyContent: 'center',
  },
});
