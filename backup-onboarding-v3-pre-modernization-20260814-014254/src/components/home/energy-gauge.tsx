import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing as RNEasing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Svg, { Path } from 'react-native-svg';
import ReanimatedAnimated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { hapticSelect } from '@/lib/haptics';

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);
const isGlassAvailable = isLiquidGlassAvailable();

/**
 * Matches the real adaptive engine's `DailyCheckIn.energyScore: 1 | 2 | 3 |
 * 4 | 5` exactly — not a 0-indexed UI convenience like CommitmentDial's
 * 0–7. Whoever wires this to the real check-in later passes this value
 * straight through, no off-by-one conversion.
 */
export type EnergyScore = 1 | 2 | 3 | 4 | 5;

const LEVELS: Array<{ score: EnergyScore; label: string }> = [
  { score: 1, label: 'Empty' },
  { score: 2, label: 'Low' },
  { score: 3, label: 'Okay' },
  { score: 4, label: 'Good' },
  { score: 5, label: 'Great' },
];

/** Flat mood scale — red at the low end through green at the high end,
 * ending exactly on the app's own brand green (#5FBE84, already used
 * everywhere else). No gradient: each wedge is one flat tone, the glass
 * outline carries the "material" instead of the fill. */
const MOOD_COLORS: Record<EnergyScore, string> = {
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

function polar(cx: number, cy: number, r: number, angleDeg: number) {
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
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function indexFromSweep(sweep: number) {
  return clamp(Math.round(sweep / STEP), 0, STOP_INTERVALS);
}

type EnergyGaugeProps = {
  size?: number;
  /** Same web coordinate-scaling correction CommitmentDial takes — see its own doc comment. */
  canvasScale?: number;
  value: EnergyScore | null;
  onChange: (score: EnergyScore) => void;
};

/**
 * "How's your energy today?" — a segmented semi-circle mood scale with a
 * draggable dial handle. Selection mechanics deliberately mirror
 * CommitmentDial: relative-delta PanResponder dragging (not tap-to-jump), a
 * haptic tick on every stop crossed, snap-to-nearest-stop on release, and
 * the same accessibility increment/decrement actions. The handle itself is
 * a real native rectangle (not an SVG shape) so it can carry genuine
 * Liquid Glass material — colored neutral black/white, radial like a dial
 * pointer rather than a circular thumb.
 */
export function EnergyGauge({ size = 240, canvasScale = 1, value, onChange }: EnergyGaugeProps) {
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
  // strokeWidth/opacity.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);
  const borderAnimatedProps = useAnimatedProps(() => ({
    strokeWidth: 1.5 + pulse.value * 3.5,
    opacity: 0.5 + pulse.value * 0.5,
  }));

  // Plain-number source of truth for the gesture math (Animated.Value has no
  // synchronous getter); the Animated.Value below mirrors it for rendering
  // and drives the release-snap easing — same split CommitmentDial uses.
  const sweepRef = useRef(0);
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    const id = sweepAnim.addListener(({ value: v }) => setSweep(v));
    return () => sweepAnim.removeListener(id);
  }, [sweepAnim]);

  const lastAngleRef = useRef(0);
  const lastIndexRef = useRef<number | null>(null);

  const originX = Platform.OS === 'web' ? cx * canvasScale : cx;
  const originY = Platform.OS === 'web' ? cy * canvasScale : cy;
  const angleAt = (locationX: number, locationY: number) => {
    const dx = locationX - originX;
    const dy = originY - locationY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  // Same "liquid" idiom as useLiquidPress: a quick flex past rest, then
  // settle — not a flat linear snap, which is what read as stiff.
  const snapTo = (idx: number) => {
    const snapped = idx * STEP;
    const from = sweepRef.current;
    sweepRef.current = snapped;

    if (from === snapped) return;

    const direction = snapped > from ? 1 : -1;
    const overshoot = snapped + direction * (STEP * 0.16);
    Animated.sequence([
      Animated.timing(sweepAnim, {
        toValue: overshoot,
        duration: 130,
        easing: RNEasing.out(RNEasing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(sweepAnim, {
        toValue: snapped,
        duration: 170,
        easing: RNEasing.out(RNEasing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path snaps and reports separately. */
  const setIndex = (idx: number) => {
    const clamped = clamp(idx, 0, STOP_INTERVALS);
    lastIndexRef.current = clamped;
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        lastAngleRef.current = angleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY);

        const idx = indexFromSweep(sweepRef.current);
        if (lastIndexRef.current !== idx) {
          lastIndexRef.current = idx;
          onChange(LEVELS[idx].score);
        }
      },
      onPanResponderMove: (evt) => {
        const angle = angleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        const delta = shortestDelta(lastAngleRef.current, angle);
        lastAngleRef.current = angle;

        // Sweep increases as the raw angle decreases — score 1 sits at the
        // high-angle/left end of the dome, score 5 at the low-angle/right end.
        sweepRef.current = clamp(sweepRef.current - delta, 0, SWEEP_RANGE);
        sweepAnim.setValue(sweepRef.current);

        const idx = indexFromSweep(sweepRef.current);
        if (lastIndexRef.current !== idx) {
          lastIndexRef.current = idx;
          hapticSelect();
          onChange(LEVELS[idx].score);
        }
      },
      onPanResponderRelease: () => snapTo(indexFromSweep(sweepRef.current)),
      onPanResponderTerminate: () => snapTo(indexFromSweep(sweepRef.current)),
    })
  ).current;

  const handleAngle = START_ANGLE - sweep;
  const handlePoint = polar(cx, cy, handleRadius, handleAngle);
  // A vertical rectangle points at math-angle 90° (12 o'clock) by default;
  // rotating by (90 - angle) aligns its long axis with the radius at the
  // handle's current angle, like a dial needle.
  const handleRotation = 90 - handleAngle;

  return (
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
      {...panResponder.panHandlers}
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
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.handle,
          {
            left: handlePoint.x - handleWidth / 2,
            top: handlePoint.y - handleHeight / 2,
            width: handleWidth,
            height: handleHeight,
            borderRadius: handleWidth * 0.3,
            backgroundColor: 'rgba(10,10,10,0.9)',
            borderColor: 'rgba(255,255,255,0.55)',
            transform: [{ rotate: `${handleRotation}deg` }],
          },
        ]}
      >
        {isGlassAvailable ? (
          <GlassView glassEffectStyle="regular" tintColor="#0A0A0A" style={StyleSheet.absoluteFill} />
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.readout}>
        <Text style={styles.readoutValue}>{selected ? selected.score : '—'}</Text>
        <Text style={styles.readoutLabel}>{selected ? selected.label : 'Drag to check in'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#ffffff',
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
