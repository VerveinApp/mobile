import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedAnimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useAppColors } from '@/lib/theme-context';

export const ONBOARDING_STEP_COUNT = 7;

/**
 * Thin segmented progress bar spanning the header — one segment per
 * onboarding step. Each screen is its own route (a fresh mount, not a
 * shared instance carried across steps), so "animated" here means each
 * active segment draws itself in on mount, left to right with a slight
 * stagger — a "here's how far you've come" reveal every time you land on a
 * new step, not a one-off effect that only fires once for the whole flow.
 */
export function OnboardingProgress({ step }: { step: number }) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => (
        <ProgressSegment key={i} active={i < step} delay={i * 40} styles={styles} />
      ))}
    </View>
  );
}

function ProgressSegment({
  active,
  delay,
  styles,
}: {
  active: boolean;
  delay: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(reducedMotion && active ? 1 : 0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      fill.value = 1;
      return;
    }
    fill.value = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [active, delay, fill, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={styles.segmentTrack}>
      <ReanimatedAnimated.View
        style={[styles.segmentFill, { transformOrigin: 'left' }, animatedStyle]}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    row: {
      position: 'absolute',
      left: 48,
      right: 48,
      top: 66,
      flexDirection: 'row',
      gap: 6,
    },
    segmentTrack: {
      flex: 1,
      height: 1.5,
      backgroundColor: colors.surfaceBorder,
      overflow: 'hidden',
    },
    segmentFill: {
      flex: 1,
      backgroundColor: colors.text,
    },
  });
}
