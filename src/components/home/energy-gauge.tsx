import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { hapticSelect } from '@/lib/haptics';
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
  size?: number;
  /** Same web coordinate-scaling correction CommitmentDial takes — see its own doc comment. */
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
 * Selection mechanics carried over from the old dial: a haptic tick on
 * every segment crossed while dragging, and the selected segment's own
 * outline breathes (paused at a steady mid-value under Reduced Motion) —
 * same feel, just applied to a rectangle's border instead of an SVG wedge's
 * stroke. The same VoiceOver "adjustable" role + increment/decrement
 * actions are preserved unchanged from the original.
 */
export function EnergyGauge({ size = 260, canvasScale = 1, value, onChange, previousValue = null }: EnergyGaugeProps) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const trackHeight = Math.round(size * 0.22);
  const segmentWidth = (size - SEGMENT_GAP * (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;

  const selected = value !== null ? LEVELS[value - 1] : null;
  const isSet = value !== null;

  // Same "breathes once settled" outline as the old dial's selected-wedge
  // stroke — Reduced Motion users get the same bright outline held at a
  // steady mid-value instead of the loop, still legible as "selected."
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = reducedMotion ? 0.5 : withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, reducedMotion]);
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    borderWidth: 1.5 + pulse.value * 2.5,
    opacity: 0.6 + pulse.value * 0.4,
  }));

  const lastIndex = useSharedValue(value !== null ? value - 1 : -1);
  // Same web coordinate-scaling correction the old dial applied to its own
  // gesture-origin math (see CommitmentDial's own doc comment) — only ever
  // exercised on web, a no-op at canvasScale's default of 1 everywhere else.
  const effectiveWidth = Platform.OS === 'web' ? size * canvasScale : size;

  const setIndex = (idx: number, tick: boolean) => {
    if (tick) hapticSelect();
    lastIndex.value = idx;
    onChange(LEVELS[idx].score);
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          const idx = clamp(Math.floor((e.x / effectiveWidth) * SEGMENT_COUNT), 0, SEGMENT_COUNT - 1);
          const changed = idx !== lastIndex.value;
          lastIndex.value = idx;
          runOnJS(setIndex)(idx, changed);
        })
        .onUpdate((e) => {
          const idx = clamp(Math.floor((e.x / effectiveWidth) * SEGMENT_COUNT), 0, SEGMENT_COUNT - 1);
          if (idx !== lastIndex.value) {
            lastIndex.value = idx;
            runOnJS(setIndex)(idx, true);
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, effectiveWidth]
  );

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path ticks and reports separately. */
  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const current = value !== null ? value - 1 : -1;
    if (event.nativeEvent.actionName === 'increment') {
      setIndex(Math.min(current + 1, SEGMENT_COUNT - 1), true);
    } else if (event.nativeEvent.actionName === 'decrement') {
      setIndex(Math.max(current - 1, 0), true);
    }
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View
          style={[styles.track, { width: size, height: trackHeight }]}
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
            const isPrevious = level.score === previousValue && level.score !== value;
            return (
              <View
                key={level.score}
                style={[
                  styles.segment,
                  {
                    width: segmentWidth,
                    height: trackHeight,
                    backgroundColor: MOOD_COLORS[level.score],
                    opacity: isSelected ? 1 : 0.85,
                    marginRight: i < SEGMENT_COUNT - 1 ? SEGMENT_GAP : 0,
                  },
                ]}
              >
                {isGlassAvailable && isSelected ? (
                  <GlassView glassEffectStyle="regular" tintColor="#FFFFFF" style={StyleSheet.absoluteFill} />
                ) : null}
                {isSelected ? (
                  <ReanimatedAnimated.View pointerEvents="none" style={[styles.segmentOutline, pulseAnimatedStyle]} />
                ) : null}
                {isPrevious ? <View pointerEvents="none" style={styles.previousMarker} /> : null}
              </View>
            );
          })}
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
      borderColor: 'rgba(255,255,255,0.95)',
    },
    previousMarker: {
      position: 'absolute',
      bottom: 6,
      left: '50%',
      marginLeft: -2,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.7)',
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
      fontSize: 11,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
