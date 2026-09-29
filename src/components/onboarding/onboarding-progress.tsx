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
/** `settled` for a follow-up screen within a step (onboarding/equipment.tsx
 * after step 4): its segment is already full, so it doesn't fill again. */
export function OnboardingProgress({ step, settled = false }: { step: number; settled?: boolean }) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row} pointerEvents="none">
      {/* Only the segment for THIS step animates. BUG FIX: every step is its
          own screen with its own fresh bar, so every already-completed
          segment used to re-fill from empty (staggered) each time a new
          step mounted — the whole bar visibly resetting and refilling on
          every screen instead of just advancing by one. */}
      {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => (
        <ProgressSegment key={i} active={i < step} animateIn={!settled && i === step - 1} styles={styles} />
      ))}
    </View>
  );
}

function ProgressSegment({
  active,
  animateIn,
  styles,
}: {
  active: boolean;
  /** True only for the newest segment — earlier ones start already full. */
  animateIn: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(active && (reducedMotion || !animateIn) ? 1 : 0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion || !animateIn) {
      fill.value = 1;
      return;
    }
    // A short beat after the screen's own slide-in lands, so the advance
    // reads as its own moment rather than getting lost in the transition.
    fill.value = withDelay(120, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [active, animateIn, fill, reducedMotion]);

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
