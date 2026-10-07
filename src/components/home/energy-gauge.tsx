import { useEffect, useMemo } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Type } from '@/constants/theme';
import { scaleCanvasStyles, useCanvasUnit } from '@/lib/canvas-scale';
import { hapticSelect } from '@/lib/haptics';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
import { useAppColors } from '@/lib/theme-context';

const isGlassAvailable = isLiquidGlassAvailable();

/**
 * Matches the real adaptive engine's `DailyCheckIn.energyScore: 1 | 2 | 3 |
 * 4 | 5` exactly — not a 0-indexed UI convenience like CommitmentDial's
 * 0–7. Whoever wires this to the real check-in later passes this value
 * straight through, no off-by-one conversion.
 */
export type EnergyScore = 1 | 2 | 3 | 4 | 5;

const LEVELS: { score: EnergyScore; label: string }[] = [
  { score: 1, label: 'Empty' },
  { score: 2, label: 'Low' },
  { score: 3, label: 'Okay' },
  { score: 4, label: 'Good' },
  { score: 5, label: 'Great' },
];

/** Exported so other screens (e.g. the resolved-session summary chip) can
 * label a score without duplicating this list. */
export const ENERGY_LABELS: Record<EnergyScore, string> = LEVELS.reduce(
  (acc, level) => ({ ...acc, [level.score]: level.label }),
  {} as Record<EnergyScore, string>
);

/** Flat mood scale — red at the low end through green at the high end,
 * ending exactly on the app's own brand green (#5FBE84, already used
 * everywhere else). No gradient: each segment is one flat tone. Exported
 * for the same reason as ENERGY_LABELS above. */
export const MOOD_COLORS: Record<EnergyScore, string> = {
  1: '#E5484D',
  2: '#E8823C',
  3: '#D9B23C',
  4: '#8FBF5C',
  5: '#5FBE84',
};

const SEGMENT_COUNT = LEVELS.length;
const SEGMENT_GAP = 4;

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

type EnergyGaugeProps = {
  /** In canvas units inside a fixed-canvas screen (see canvas-scale.ts). */
  size?: number;
  /** @deprecated Ignored, same as CommitmentDial's — see its own doc comment. */
  canvasScale?: number;
  value: EnergyScore | null;
  onChange: (score: EnergyScore) => void;
  /** Yesterday's (or last recorded) check-in — rendered as a faint ghost marker, not compared for you. */
  previousValue?: EnergyScore | null;
};

/**
 * "How's your energy today?" — a horizontal, 5-segment mood scale you drag
 * or tap across. Redesigned from the original semicircular dial to a flat
 * segmented bar: absolute finger-x maps directly to a segment, so a tap and
 * the start of a drag are the same gesture (no separate tap-vs-drag branch
 * the old radial version needed to distinguish), and every segment is its
 * own clearly-bounded rectangle rather than a pie-slice whose hit area is
 * easy to misjudge near the dome's edges.
 *
 * Selection: a haptic tick on every segment crossed while dragging, and
 * the picked segment springs up to full height and strength while the
 * others settle back, shorter and dimmer — the same treatment as the
 * vervein.app check-in demo. It's driven from the gesture's own shared
 * index on the UI thread, so it follows the finger through a drag instead
 * of waiting for the screen to re-render. Height carries the selection as
 * well as the static white outline, so it never rests on color alone.
 * Reduced Motion snaps instead of springing (Reanimated's default). The
 * VoiceOver "adjustable" role + increment/decrement actions are unchanged.
 */
export function EnergyGauge({ size = 260, value, onChange, previousValue = null }: EnergyGaugeProps) {
  const colors = useAppColors();
  // Inside a fixed-canvas screen every length is in canvas units (see
  // canvas-scale.ts): the track's geometry below is worked out in those
  // units, then converted to real points, so layout and touch math agree.
  const unit = useCanvasUnit();
  const styles = useMemo(() => scaleCanvasStyles(createStyles(colors), unit), [colors, unit]);
  const trackHeightCanvas = Math.round(size * 0.22);
  const segmentWidthCanvas = (size - SEGMENT_GAP * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;
  const trackWidth = size * unit;
  const trackHeight = trackHeightCanvas * unit;
  const segmentWidth = segmentWidthCanvas * unit;
  const segmentGap = SEGMENT_GAP * unit;

  const selected = value !== null ? LEVELS[value - 1] : null;
  const isSet = value !== null;

  // The picked segment's index, owned by the UI thread: the gesture worklets
  // write it the moment the finger crosses a segment, and every segment's
  // spring reads it. The `value` prop trails it by a render.
  const lastIndex = useSharedValue(value !== null ? value - 1 : -1);
  // Once the finger has picked, the gesture owns the selection. A heavy
  // check-in render can hand back an in-between value from the same drag
  // (or a quick run of taps) after the finger has already moved on, and
  // syncing that echo into lastIndex would spring the segments back a step.
  // So the prop is only followed for changes that can't be an echo: a
  // restored session before any touch, or a reset to nothing picked (which
  // also hands ownership back, so a later restore is followed again). The
  // flag is set in the gesture worklets beside lastIndex itself, so it's
  // already true by the time any echo reaches the effect. A parent that
  // needs to set a different level after the user has touched the gauge
  // should remount it with a `key`; check-in.tsx never does (a restored
  // session swaps the gauge out for the resolved view).
  const gestureOwnsSelection = useSharedValue(false);
  useEffect(() => {
    if (value === null) {
      gestureOwnsSelection.set(false);
      lastIndex.set(-1);
      return;
    }
    if (!gestureOwnsSelection.get()) lastIndex.set(value - 1);
  }, [value, lastIndex, gestureOwnsSelection]);
  // Touches arrive in real points on every platform, the same units as
  // trackWidth. (This used to be a web-only `size * canvasScale`
  // correction for a canvas drawn under a scale transform.)
  const effectiveWidth = trackWidth;

  // Gesture path: lastIndex was already set on the UI thread, so this only
  // ticks and reports (writing it here, a beat late, is what used to pull
  // the segments back).
  const reportFromGesture = (idx: number, tick: boolean) => {
    if (tick) hapticSelect();
    onChange(LEVELS[idx].score);
  };

  // BUG FIX: the pan used to select on onBegin — the instant a finger
  // touched down, before it was known whether this was a drag across the
  // gauge or the start of a vertical scroll of the check-in screen. Scrolling
  // with a thumb that happened to land on the gauge changed today's energy.
  // Now a pan only claims the touch once it's clearly horizontal (the same
  // activeOffsetX/failOffsetY pairing the paywall's benefit pager uses), and
  // a plain tap selects through its own Tap gesture.
  const gauge = useMemo(
    () => {
      const indexAt = (x: number) => {
        'worklet';
        return clamp(Math.floor((x / effectiveWidth) * SEGMENT_COUNT), 0, SEGMENT_COUNT - 1);
      };
      const pan = Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-10, 10])
        .onStart((e) => {
          const idx = indexAt(e.x);
          const changed = idx !== lastIndex.get();
          lastIndex.set(idx);
          gestureOwnsSelection.set(true);
          scheduleOnRN(reportFromGesture, idx, changed);
        })
        .onUpdate((e) => {
          const idx = indexAt(e.x);
          if (idx !== lastIndex.get()) {
            lastIndex.set(idx);
            gestureOwnsSelection.set(true);
            scheduleOnRN(reportFromGesture, idx, true);
          }
        });
      const tap = Gesture.Tap().onEnd((e, success) => {
        if (!success) return;
        const idx = indexAt(e.x);
        const changed = idx !== lastIndex.get();
        lastIndex.set(idx);
        gestureOwnsSelection.set(true);
        scheduleOnRN(reportFromGesture, idx, changed);
      });
      return Gesture.Race(pan, tap);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, effectiveWidth]
  );

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path ticks and reports separately. */
  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const current = value !== null ? value - 1 : -1;
    const next =
      event.nativeEvent.actionName === 'increment'
        ? Math.min(current + 1, SEGMENT_COUNT - 1)
        : event.nativeEvent.actionName === 'decrement'
          ? Math.max(current - 1, 0)
          : null;
    if (next === null) return;
    hapticSelect();
    lastIndex.set(next);
    onChange(LEVELS[next].score);
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gauge}>
        <View
          style={[styles.track, { width: trackWidth, height: trackHeight }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Energy level"
          accessibilityValue={{
            min: 1,
            max: SEGMENT_COUNT,
            now: isSet ? (value as number) : undefined,
            text: isSet ? `${value} of ${SEGMENT_COUNT}${selected ? `, ${selected.label}` : ''}` : 'Not set',
          }}
          accessibilityActions={[
            { name: 'increment', label: 'Increase energy level' },
            { name: 'decrement', label: 'Decrease energy level' },
          ]}
          onAccessibilityAction={handleAccessibilityAction}
        >
          {LEVELS.map((level, i) => {
            const isSelected = level.score === value;
            return (
              <GaugeSegment
                key={level.score}
                index={i}
                selectedIndex={lastIndex}
                color={MOOD_COLORS[level.score]}
                shellStyle={[
                  styles.segment,
                  { width: segmentWidth, height: trackHeight, marginRight: i < SEGMENT_COUNT - 1 ? segmentGap : 0 },
                ]}
                outlineStyle={styles.segmentOutline}
              >
                {/* BUG FIX: was tintColor="#FFFFFF" — a white frost veil over
                    whatever's underneath, which reads fine on the darker
                    ends of MOOD_COLORS (red, green) but visibly washes out
                    the lighter middle ones (orange, yellow) toward pale/
                    faded instead of "selected." Tinting with the segment's
                    own color instead reinforces its real hue through the
                    glass — the standard tinted-glass pattern (matching a
                    control's own accent color, not a mismatched white) —
                    so the selected segment reads as more vivid, not less,
                    regardless of which one it is. */}
                {isGlassAvailable && isSelected ? (
                  <GlassView
                    glassEffectStyle="regular"
                    tintColor={MOOD_COLORS[level.score]}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
              </GaugeSegment>
            );
          })}
          {/* Yesterday's level, drawn over the row rather than inside its
              segment: once anything is picked that segment is shrunk and
              dimmed, which squashed this dot and nearly hid it. */}
          {previousValue !== null && previousValue !== value ? (
            <View
              pointerEvents="none"
              style={[
                styles.previousMarker,
                { left: (previousValue - 1) * (segmentWidth + segmentGap) + segmentWidth / 2 - (PREVIOUS_MARKER_SIZE * unit) / 2 },
              ]}
            />
          ) : null}
        </View>
      </GestureDetector>

      <View pointerEvents="none" style={styles.readout}>
        <Text style={styles.readoutValue} maxFontSizeMultiplier={1.2}>
          {selected ? selected.score : '—'}
        </Text>
        <Text style={styles.readoutLabel} maxFontSizeMultiplier={1.3}>
          {selected ? selected.label : 'Drag to check in'}
        </Text>
      </View>
    </View>
  );
}

// Unpicked segments sit a little shorter and dimmer so the picked one
// stands up out of the row. With nothing picked yet, every segment is full
// height at the gauge's resting strength, inviting a first touch.
const RESTING_OPACITY = 0.85;
const PREVIOUS_MARKER_SIZE = 5;
const RECEDED_OPACITY = 0.5;
const RECEDED_SCALE = 0.78;
const SEGMENT_SPRING = { duration: 420, dampingRatio: 0.62 };

/**
 * One segment. Its own component so each can hold its animated styles,
 * which read the shared selected index directly: the spring, the dim and
 * the outline all move on the same frame the finger crosses into it.
 *
 * Only the colour fill dims, never the segment itself. The glass tint and
 * yesterday's marker sit above the fill at full strength: Apple's glass
 * effect isn't meant to live under a fading parent, and the marker would
 * otherwise fade out exactly when you're comparing against it.
 */
function GaugeSegment({
  index,
  selectedIndex,
  color,
  shellStyle,
  outlineStyle,
  children,
}: {
  index: number;
  selectedIndex: SharedValue<number>;
  color: string;
  shellStyle: StyleProp<ViewStyle>;
  outlineStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const shellAnimatedStyle = useAnimatedStyle(() => {
    const nothingPicked = selectedIndex.get() < 0;
    const picked = selectedIndex.get() === index;
    return { transform: [{ scaleY: withSpring(nothingPicked || picked ? 1 : RECEDED_SCALE, SEGMENT_SPRING) }] };
  });
  const fillAnimatedStyle = useAnimatedStyle(() => {
    const nothingPicked = selectedIndex.get() < 0;
    const picked = selectedIndex.get() === index;
    return {
      opacity: withTiming(nothingPicked ? RESTING_OPACITY : picked ? 1 : RECEDED_OPACITY, {
        duration: MOTION_DURATION.fast,
        easing: MOTION_EASING.standard,
      }),
    };
  });
  const outlineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(selectedIndex.get() === index ? 1 : 0, {
      duration: MOTION_DURATION.fast,
      easing: MOTION_EASING.standard,
    }),
  }));
  return (
    <ReanimatedAnimated.View style={[shellStyle, segmentStyles.origin, shellAnimatedStyle]}>
      <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, fillAnimatedStyle]} />
      {children}
      <ReanimatedAnimated.View pointerEvents="none" style={[outlineStyle, outlineAnimatedStyle]} />
    </ReanimatedAnimated.View>
  );
}

const segmentStyles = StyleSheet.create({
  // Shrinks toward the baseline, so the row keeps one bottom edge.
  origin: { transformOrigin: 'bottom' },
});

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
    },
    track: {
      flexDirection: 'row',
    },
    segment: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    segmentOutline: {
      ...StyleSheet.absoluteFill,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.95)',
      // Clipping (it has no children) makes iOS draw this border as a vector
      // outline instead of a bitmap, which stays crisp through the
      // segment's spring.
      overflow: 'hidden',
    },
    // Yesterday's level. The theme's text colour, not white: once a level is
    // picked the other segments dim toward the background, and a white dot
    // on a pale segment all but disappeared in light mode.
    previousMarker: {
      position: 'absolute',
      bottom: 6,
      width: PREVIOUS_MARKER_SIZE,
      height: PREVIOUS_MARKER_SIZE,
      borderRadius: PREVIOUS_MARKER_SIZE / 2,
      backgroundColor: colors.text,
      opacity: 0.7,
    },
    readout: {
      marginTop: 14,
      alignItems: 'center',
    },
    readoutValue: {
      color: colors.text,
      fontSize: 26,
      letterSpacing: -0.4,
      fontFamily: 'Geist-Black',
    },
    readoutLabel: {
      marginTop: 2,
      color: '#438C63',
      fontSize: Type.caption,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
