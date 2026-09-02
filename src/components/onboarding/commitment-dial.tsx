import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import ReanimatedAnimated, { runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { hapticSelect } from '@/lib/haptics';
import { useAppTheme } from '@/lib/theme-context';

const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);
const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

const STOP_COUNT = 8;
const STOP_INTERVALS = STOP_COUNT - 1;

// The ring sweeps 300° clockwise starting from START_ANGLE (measured
// clockwise from 12 o'clock), leaving a fixed 60° gap at the bottom — a
// bounded arc rather than a full loop, so "all in" and "bare minimum" read
// as clear, distinct ends rather than ambiguous wraparound positions.
const START_ANGLE = 210;
const SWEEP_RANGE = 300;
const STEP = SWEEP_RANGE / STOP_INTERVALS;

/** Normalizes any angle difference to (-180, 180] so a drag that crosses the atan2 wraparound seam doesn't register as a sudden 360° jump. */
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

/** Point on the ring at `angleDeg` clockwise from 12 o'clock. */
function pointAt(cx: number, cy: number, r: number, angleDeg: number) {
  'worklet';
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  'worklet';
  const start = pointAt(cx, cy, r, startDeg);
  const end = pointAt(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

type CommitmentDialProps = {
  size?: number;
  /**
   * The screen's own canvas scale factor (windowWidth / 375). Every screen
   * in this app is authored at a fixed 375pt width and CSS-scaled to fit
   * the real window. On web that scaling means touch coordinates
   * (locationX/Y) come back in *rendered* CSS-pixel space — `size` scaled
   * up by this same factor — rather than `size`'s own unit space; on native
   * iOS, UIKit already resolves locationX/Y in the view's own local units
   * regardless of transforms, so no correction is needed there.
   */
  canvasScale?: number;
  /** Selected stop index (0–7), or null before the user has touched the dial. */
  value: number | null;
  onChange: (index: number) => void;
  /** Current level's display name, read out by VoiceOver/TalkBack alongside the number. */
  levelLabel?: string;
};

/**
 * A bounded circular progress-ring slider with 8 discrete stops. Drag the
 * handle anywhere on the ring to sweep it; it follows the finger
 * continuously and snaps to the nearest stop on release. A thick gradient
 * arc fills from the low end up to the handle, which carries a checkmark
 * once a value is set — a premium physical control, not gear teeth or a
 * game meter.
 *
 * The drag lives on the UI thread via react-native-gesture-handler +
 * Reanimated worklets (no PanResponder, no classic Animated.Value) — same
 * migration as EnergyGauge, for the same reason: the old version routed
 * every touch-move through the JS thread, this one never leaves the UI
 * thread while dragging.
 */
export function CommitmentDial({ size = 220, canvasScale = 1, value, onChange, levelLabel }: CommitmentDialProps) {
  const { resolvedScheme } = useAppTheme();
  // DISCLOSED FIX: previously always useSharedValue(0), regardless of an
  // incoming non-null `value` — step-7.tsx explicitly seeds `value` from a
  // route param when navigating back to this screen ("carries the prior
  // commitment level forward"), so the readout text/checkmark showed the
  // right level while the handle itself sat at the ring's start position,
  // pointing at the wrong stop. Seeding the initializer (mount-time only,
  // not a reactive effect) fixes the real bug without touching live-drag
  // behavior — sweep is otherwise only ever driven by the gesture itself.
  const sweep = useSharedValue(value !== null ? value * STEP : 0);
  const lastAngle = useSharedValue(0);
  const lastIndex = useSharedValue(value !== null ? value : -1);

  const half = (Platform.OS === 'web' ? size * canvasScale : size) / 2;
  const angleAt = (x: number, y: number) => {
    'worklet';
    const dx = x - half;
    const dy = y - half;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  // Called from both the gesture worklet and plain JS (accessibility), so
  // it's explicitly marked as a worklet rather than relying on
  // auto-workletization.
  const snapTo = (idx: number) => {
    'worklet';
    const snapped = idx * STEP;
    sweep.value = withTiming(snapped, { duration: 160 });
  };

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path snaps and reports separately. */
  const setIndex = (idx: number) => {
    const clamped = clamp(idx, 0, STOP_INTERVALS);
    lastIndex.value = clamped;
    hapticSelect();
    onChange(clamped);
    snapTo(clamped);
  };

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const current = value ?? -1;
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

          const idx = indexFromSweep(sweep.value);
          if (lastIndex.value !== idx) {
            lastIndex.value = idx;
            runOnJS(onChange)(idx);
          }
        })
        .onUpdate((e) => {
          const angle = angleAt(e.x, e.y);
          const delta = shortestDelta(lastAngle.value, angle);
          lastAngle.value = angle;

          sweep.value = clamp(sweep.value + delta, 0, SWEEP_RANGE);

          const idx = indexFromSweep(sweep.value);
          if (lastIndex.value !== idx) {
            lastIndex.value = idx;
            runOnJS(hapticSelect)();
            runOnJS(onChange)(idx);
          }
        })
        .onEnd(() => {
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

  const c = size / 2;
  const ringR = size * 0.4;
  const strokeWidth = size * 0.075;
  const handleR = size * 0.075;
  const checkSize = handleR * 1.15;
  const isSet = value !== null;

  const arcAnimatedProps = useAnimatedProps(() => {
    const endAngle = START_ANGLE + sweep.value;
    return { d: sweep.value > 0.5 ? describeArc(c, c, ringR, START_ANGLE, endAngle) : '' };
  });

  const handleAnimatedProps = useAnimatedProps(() => {
    const endAngle = START_ANGLE + sweep.value;
    const point = pointAt(c, c, ringR, endAngle);
    return { cx: point.x, cy: point.y };
  });

  const checkAnimatedProps = useAnimatedProps(() => {
    const endAngle = START_ANGLE + sweep.value;
    const point = pointAt(c, c, ringR, endAngle);
    return {
      d: `M ${point.x - checkSize * 0.32} ${point.y + checkSize * 0.02}
          L ${point.x - checkSize * 0.08} ${point.y + checkSize * 0.28}
          L ${point.x + checkSize * 0.34} ${point.y - checkSize * 0.26}`,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Commitment level"
        accessibilityValue={{
          min: 1,
          max: STOP_COUNT,
          now: isSet ? (value as number) + 1 : undefined,
          text: isSet ? `${(value as number) + 1} of ${STOP_COUNT}${levelLabel ? `, ${levelLabel}` : ''}` : 'Not set',
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase commitment level' },
          { name: 'decrement', label: 'Decrease commitment level' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        {/* Subtle glow behind the ring — same restrained accent used elsewhere, not a spotlight. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#438C63', opacity: 0.05 }}
        />

        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
          <Defs>
            <LinearGradient id="commitmentArc" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#1F4A31" />
              <Stop offset="100%" stopColor="#5FBE84" />
            </LinearGradient>
          </Defs>

          <AnimatedPath
            animatedProps={arcAnimatedProps}
            stroke="url(#commitmentArc)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />

          <AnimatedCircle
            animatedProps={handleAnimatedProps}
            r={handleR}
            fill={isSet ? '#ffffff' : '#0C0C0C'}
            // The "set" handle is a white fill — invisible against a white
            // light-mode canvas without an outline (dark mode's own white-on-
            // white stroke works fine since it sits on black). Only light
            // mode gets the extra outline; dark mode is untouched.
            stroke={isSet ? (resolvedScheme === 'light' ? 'rgba(0,0,0,0.2)' : '#ffffff') : '#676767'}
            strokeWidth={1}
          />
          {isSet ? (
            <AnimatedPath
              animatedProps={checkAnimatedProps}
              stroke="#2f6647"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
    </GestureDetector>
  );
}
