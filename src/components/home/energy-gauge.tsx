import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import ReanimatedAnimated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hapticSelect } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);
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
 * everywhere else). No gradient: each wedge is one flat tone, the glass
 * outline carries the "material" instead of the fill. Exported for the same
 * reason as ENERGY_LABELS above. */
export const MOOD_COLORS: Record<EnergyScore, string> = {
  1: '#E5484D',
  2: '#E8823C',
  3: '#D9B23C',
  4: '#8FBF5C',
  5: '#5FBE84',
};

// Real Liquid Glass (GlassView, below) can't trace an arbitrary curved SVG
// path — it's a native compositing surface, not a vector fill. The wedges'
// "liquid glass like" outline is an SVG approximation: a bright translucent
// hairline standing in for a glass edge/bevel highlight.
const GLASS_STROKE = 'rgba(255,255,255,0.4)';
const GLASS_STROKE_SELECTED = 'rgba(255,255,255,0.95)';

// A flat-bottomed dome — 180° of sweep, 0° at the right (3 o'clock) through
// 180° at the left (9 o'clock), passing through 90° (12 o'clock) — the
// classic speedometer/fuel-gauge orientation.
const WEDGE_COUNT = LEVELS.length;
const WEDGE_SWEEP = 180 / WEDGE_COUNT;
const GAP_DEG = 3; // small visible seam between wedges

const STOP_INTERVALS = WEDGE_COUNT - 1;
// Stop spacing matches wedge spacing exactly, so the handle snaps to each
// wedge's own center — same relationship CommitmentDial's STEP has to its
// own ring positions.
const STEP = WEDGE_SWEEP;
const SWEEP_RANGE = STEP * STOP_INTERVALS;
// The handle's resting angle at sweep=0 (score 1) — dead center of the
// first wedge.
const START_ANGLE = 180 - WEDGE_SWEEP / 2;
// Below this much total finger movement, a gesture counts as a tap (jump to
// that wedge) rather than a drag (relative sweep).
const TAP_MOVE_THRESHOLD = 6;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  'worklet';
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/** An annular (donut) wedge path — outer arc, in, inner arc back, close. */
function wedgePath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const o1 = polar(cx, cy, rOuter, startDeg);
  const o2 = polar(cx, cy, rOuter, endDeg);
  const i1 = polar(cx, cy, rInner, endDeg);
  const i2 = polar(cx, cy, rInner, startDeg);
  return `M ${o1.x} ${o1.y} A ${rOuter} ${rOuter} 0 0 0 ${o2.x} ${o2.y} L ${i1.x} ${i1.y} A ${rInner} ${rInner} 0 0 1 ${i2.x} ${i2.y} Z`;
}

/** Normalizes an angle difference to (-180, 180] so a fast drag near the atan2 seam doesn't register as a sudden jump — same guard CommitmentDial uses. */
function shortestDelta(from: number, to: number) {
  'worklet';
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

function indexFromSweep(sweep: number) {
  'worklet';
  return clamp(Math.round(sweep / STEP), 0, STOP_INTERVALS);
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
 * "How's your energy today?" — a segmented semi-circle mood scale with a
 * draggable dial handle. Selection mechanics deliberately mirror
 * CommitmentDial: relative-delta dragging (not tap-to-jump — tap is a
 * separate, additional path, see TAP_MOVE_THRESHOLD), a haptic tick on
 * every stop crossed, snap-to-nearest-stop on release, and the same
 * accessibility increment/decrement actions.
 *
 * The whole drag lives on the UI thread via react-native-gesture-handler +
 * Reanimated worklets — no PanResponder, no classic Animated.Value. The old
 * PanResponder version routed every touch-move through the JS thread
 * (event → JS handler → setValue → listener → setState → re-render); this
 * version's gesture callbacks and the handle's position/rotation are both
 * worklets, so dragging never waits on the JS thread at all.
 *
 * The handle itself is a real native rectangle (not an SVG shape) so it can
 * carry genuine Liquid Glass material — colored neutral black/white, radial
 * like a dial pointer rather than a circular thumb.
 */
export function EnergyGauge({ size = 240, canvasScale = 1, value, onChange, previousValue = null }: EnergyGaugeProps) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const height = size * 0.72;
  const cx = size / 2;
  const cy = size * 0.56;
  const rOuter = size * 0.46;
  const rInner = size * 0.29;
  const handleRadius = (rOuter + rInner) / 2;
  const handleWidth = size * 0.055;
  const handleHeight = (rOuter - rInner) * 1.32;

  const selected = value !== null ? LEVELS[value - 1] : null;
  const isSet = value !== null;

  const wedges = useMemo(
    () =>
      LEVELS.map((level, i) => {
        const start = 180 - i * WEDGE_SWEEP - GAP_DEG / 2;
        const end = 180 - (i + 1) * WEDGE_SWEEP + GAP_DEG / 2;
        return { level, d: wedgePath(cx, cy, rOuter, rInner, start, end) };
      }),
    [cx, cy, rOuter, rInner]
  );

  const selectedWedge = value !== null ? wedges.find((w) => w.level.score === value) : undefined;

  // The selected wedge's own glass outline breathes — no separate halo
  // shape behind it, the stroke itself radiates via animated
  // strokeWidth/opacity. Reduced-motion users get the same bright outline
  // held at a steady mid-value instead of the loop — still legible as
  // "selected," no motion.
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = reducedMotion ? 0.5 : withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, reducedMotion]);
  const borderAnimatedProps = useAnimatedProps(() => ({
    strokeWidth: 1.5 + pulse.value * 3.5,
    opacity: 0.5 + pulse.value * 0.5,
  }));

  // UI-thread gesture state.
  const sweep = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  const lastIndex = useSharedValue(-1);
  const grantX = useSharedValue(0);
  const grantY = useSharedValue(0);

  const originX = Platform.OS === 'web' ? cx * canvasScale : cx;
  const originY = Platform.OS === 'web' ? cy * canvasScale : cy;
  const angleAt = (x: number, y: number) => {
    'worklet';
    const dx = x - originX;
    const dy = originY - y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  // Same "liquid" idiom as useLiquidPress: a quick flex past rest, then
  // settle — not a flat linear snap, which is what read as stiff. Called
  // from both the gesture worklet and plain JS (accessibility), so it's
  // explicitly marked as a worklet rather than relying on auto-workletization.
  const snapTo = (idx: number) => {
    'worklet';
    const snapped = idx * STEP;
    const from = sweep.value;
    if (from === snapped) return;

    const direction = snapped > from ? 1 : -1;
    const overshoot = snapped + direction * (STEP * 0.16);
    sweep.value = withSequence(
      withTiming(overshoot, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(snapped, { duration: 170, easing: Easing.out(Easing.quad) })
    );
  };

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path snaps and reports separately. */
  const setIndex = (idx: number) => {
    const clamped = clamp(idx, 0, STOP_INTERVALS);
    lastIndex.value = clamped;
    hapticSelect();
    onChange(LEVELS[clamped].score);
    snapTo(clamped);
  };

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const current = value !== null ? value - 1 : -1;
    if (event.nativeEvent.actionName === 'increment') {
      setIndex(Math.min(current + 1, STOP_INTERVALS));
    } else if (event.nativeEvent.actionName === 'decrement') {
      setIndex(Math.max(current - 1, 0));
    }
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          lastAngle.value = angleAt(e.x, e.y);
          grantX.value = e.x;
          grantY.value = e.y;

          const idx = indexFromSweep(sweep.value);
          if (lastIndex.value !== idx) {
            lastIndex.value = idx;
            runOnJS(onChange)(LEVELS[idx].score);
          }
        })
        .onUpdate((e) => {
          const angle = angleAt(e.x, e.y);
          const delta = shortestDelta(lastAngle.value, angle);
          lastAngle.value = angle;

          // Sweep increases as the raw angle decreases — score 1 sits at the
          // high-angle/left end of the dome, score 5 at the low-angle/right end.
          sweep.value = clamp(sweep.value - delta, 0, SWEEP_RANGE);

          const idx = indexFromSweep(sweep.value);
          if (lastIndex.value !== idx) {
            lastIndex.value = idx;
            runOnJS(hapticSelect)();
            runOnJS(onChange)(LEVELS[idx].score);
          }
        })
        .onEnd((e) => {
          // A tap (negligible movement) jumps straight to whichever wedge was
          // tapped instead of only nudging the existing sweep — drag still
          // works exactly as before for anyone who wants the physical feel,
          // tap is just the faster path for the common case of "pick my mood."
          const moved = Math.abs(e.translationX) > TAP_MOVE_THRESHOLD || Math.abs(e.translationY) > TAP_MOVE_THRESHOLD;
          if (!moved) {
            const angle = angleAt(grantX.value, grantY.value);
            const tappedSweep = clamp(START_ANGLE - angle, 0, SWEEP_RANGE);
            const idx = indexFromSweep(tappedSweep);
            if (lastIndex.value !== idx) {
              runOnJS(hapticSelect)();
            }
            lastIndex.value = idx;
            runOnJS(onChange)(LEVELS[idx].score);
            snapTo(idx);
            return;
          }
          snapTo(indexFromSweep(sweep.value));
        })
        .onFinalize((_e, success) => {
          if (!success) {
            snapTo(indexFromSweep(sweep.value));
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  const handleAnimatedStyle = useAnimatedStyle(() => {
    const angle = START_ANGLE - sweep.value;
    const point = polar(cx, cy, handleRadius, angle);
    // A vertical rectangle points at math-angle 90° (12 o'clock) by default;
    // rotating by (90 - angle) aligns its long axis with the radius at the
    // handle's current angle, like a dial needle.
    const rotation = 90 - angle;
    return {
      left: point.x - handleWidth / 2,
      top: point.y - handleHeight / 2,
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  // Same stop-angle formula as the handle's own resting positions — a
  // faint, static ring sitting on whichever wedge you picked last time.
  const ghostPoint =
    previousValue !== null && previousValue !== value
      ? polar(cx, cy, handleRadius, START_ANGLE - (previousValue - 1) * STEP)
      : null;

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={{ width: size, height }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Energy level"
        accessibilityValue={{
          min: 1,
          max: WEDGE_COUNT,
          now: isSet ? (value as number) : undefined,
          text: isSet ? `${value} of ${WEDGE_COUNT}${selected ? `, ${selected.label}` : ''}` : 'Not set',
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase energy level' },
          { name: 'decrement', label: 'Decrease energy level' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} pointerEvents="none">
          {wedges.map(({ level, d }) => (
            <Path
              key={level.score}
              d={d}
              fill={MOOD_COLORS[level.score]}
              stroke={GLASS_STROKE}
              strokeWidth={1.25}
              opacity={level.score === value ? 1 : 0.85}
            />
          ))}

          {selectedWedge ? (
            <AnimatedPath
              d={selectedWedge.d}
              stroke={GLASS_STROKE_SELECTED}
              fill="none"
              animatedProps={borderAnimatedProps}
            />
          ) : null}

          {ghostPoint ? (
            <Circle
              cx={ghostPoint.x}
              cy={ghostPoint.y}
              r={handleWidth * 0.85}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1.25}
              strokeDasharray="2,2.5"
            />
          ) : null}
        </Svg>

        <ReanimatedAnimated.View
          pointerEvents="none"
          style={[
            styles.handle,
            {
              width: handleWidth,
              height: handleHeight,
              borderRadius: handleWidth * 0.3,
              backgroundColor: 'rgba(10,10,10,0.9)',
              borderColor: 'rgba(255,255,255,0.55)',
            },
            handleAnimatedStyle,
          ]}
        >
          {isGlassAvailable ? (
            <GlassView glassEffectStyle="regular" tintColor="#0A0A0A" style={StyleSheet.absoluteFill} />
          ) : null}
        </ReanimatedAnimated.View>

        <View pointerEvents="none" style={styles.readout}>
          <Text style={styles.readoutValue} maxFontSizeMultiplier={1.2}>
            {selected ? selected.score : '—'}
          </Text>
          <Text style={styles.readoutLabel} maxFontSizeMultiplier={1.3}>
            {selected ? selected.label : 'Drag to check in'}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    handle: {
      position: 'absolute',
      borderWidth: 1,
      overflow: 'hidden',
    },
    readout: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 4,
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
