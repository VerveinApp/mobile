import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import ReanimatedAnimated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useCanvasUnit } from '@/lib/canvas-scale';
import { hapticSelect } from '@/lib/haptics';
import { MOTION_DURATION } from '@/lib/motion';
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

// A release carries on into its stop instead of easing in-and-out of it.
// 0.9 overshoots well under a degree (the props below clamp it anyway, so a
// settle at the top stop can't draw into the gap).
const SNAP_SPRING = { duration: 280, dampingRatio: 0.9, reduceMotion: ReduceMotion.System } as const;
// The handle turning from its empty look to the set one, and the check
// drawing itself in, the first time a level is picked.
const SET_FADE = { duration: MOTION_DURATION.base, reduceMotion: ReduceMotion.System } as const;

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
  /** In canvas units inside a fixed-canvas screen (see canvas-scale.ts). */
  size?: number;
  /**
   * @deprecated Ignored. This corrected web touch coordinates for a canvas
   * drawn under a scale transform; canvases now lay out at their real size
   * (canvas-scale.ts), so touches arrive in the same real points as the
   * dial on every platform, and the scale comes from CanvasScaleContext.
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
export function CommitmentDial({ size = 220, value, onChange, levelLabel }: CommitmentDialProps) {
  const { resolvedScheme } = useAppTheme();
  // The ring's geometry stays in canvas units, in the SVG's viewBox; only
  // the drawn size (and the touch math, which is in real points) scales.
  const unit = useCanvasUnit();
  const drawnSize = size * unit;
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
  // 0 = never set (dark handle, no check), 1 = set. Seeded like sweep, so
  // coming back to a set dial shows it set without replaying the fade.
  const setProgress = useSharedValue(value !== null ? 1 : 0);

  // Touches arrive in real points, so the center is half the drawn size.
  // (The old web-only `size * canvasScale` correction for a transformed
  // canvas is gone with the transform.)
  const half = drawnSize / 2;
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
    sweep.set(withSpring(snapped, SNAP_SPRING));
  };

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path snaps and reports separately. */
  const setIndex = (idx: number) => {
    const clamped = clamp(idx, 0, STOP_INTERVALS);
    lastIndex.value = clamped;
    setProgress.set(withTiming(1, SET_FADE));
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
            // The first touch is what sets a level at all: light the handle
            // up and tick like every later stop does — it used to change
            // the value silently and snap the handle white in one frame.
            if (lastIndex.value === -1) setProgress.set(withTiming(1, SET_FADE));
            lastIndex.value = idx;
            scheduleOnRN(hapticSelect);
            scheduleOnRN(onChange, idx);
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
            scheduleOnRN(hapticSelect);
            scheduleOnRN(onChange, idx);
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
    [onChange, half]
  );

  const c = size / 2;
  const ringR = size * 0.4;
  const strokeWidth = size * 0.075;
  const handleR = size * 0.075;
  const checkSize = handleR * 1.15;
  // Length of the check's two strokes (the offsets in checkAnimatedProps),
  // so it can draw itself in with a dash. The hidden state pushes the dash a
  // stroke-width past the start: a dash ending exactly on the path's end
  // can leave a round-cap dot behind.
  const checkLen = checkSize * (Math.hypot(0.24, 0.26) + Math.hypot(0.42, 0.54));
  const checkHiddenOffset = checkLen + 2;
  const isSet = value !== null;

  const arcAnimatedProps = useAnimatedProps(() => {
    const s = clamp(sweep.get(), 0, SWEEP_RANGE);
    return { d: s > 0.5 ? describeArc(c, c, ringR, START_ANGLE, START_ANGLE + s) : '' };
  });

  // Two stacked handles instead of one whose fill/stroke flips: the set
  // (white) one fades in over the empty one — a numeric opacity, not an
  // SVG colour driven from the UI thread. The empty one's outline fades out
  // underneath so light mode's faint set outline isn't darkened by it.
  const handleUnsetAnimatedProps = useAnimatedProps(() => {
    const point = pointAt(c, c, ringR, START_ANGLE + clamp(sweep.get(), 0, SWEEP_RANGE));
    return { cx: point.x, cy: point.y, strokeOpacity: 1 - setProgress.get() };
  });

  const handleSetAnimatedProps = useAnimatedProps(() => {
    const point = pointAt(c, c, ringR, START_ANGLE + clamp(sweep.get(), 0, SWEEP_RANGE));
    return { cx: point.x, cy: point.y, opacity: setProgress.get() };
  });

  const checkAnimatedProps = useAnimatedProps(() => {
    const point = pointAt(c, c, ringR, START_ANGLE + clamp(sweep.get(), 0, SWEEP_RANGE));
    return {
      d: `M ${point.x - checkSize * 0.32} ${point.y + checkSize * 0.02}
          L ${point.x - checkSize * 0.08} ${point.y + checkSize * 0.28}
          L ${point.x + checkSize * 0.34} ${point.y - checkSize * 0.26}`,
      strokeDashoffset: checkHiddenOffset * (1 - setProgress.get()),
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={{ width: drawnSize, height: drawnSize }}
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
          style={{ position: 'absolute', width: drawnSize, height: drawnSize, borderRadius: drawnSize / 2, backgroundColor: '#438C63', opacity: 0.05 }}
        />

        <Svg width={drawnSize} height={drawnSize} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
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
            animatedProps={handleUnsetAnimatedProps}
            r={handleR}
            fill="#0C0C0C"
            stroke="#676767"
            strokeWidth={1}
          />
          <AnimatedCircle
            animatedProps={handleSetAnimatedProps}
            r={handleR}
            fill="#ffffff"
            // The "set" handle is a white fill — invisible against a white
            // light-mode canvas without an outline (dark mode's own white-on-
            // white stroke works fine since it sits on black). Only light
            // mode gets the extra outline; dark mode is untouched.
            stroke={resolvedScheme === 'light' ? 'rgba(0,0,0,0.2)' : '#ffffff'}
            strokeWidth={1}
          />
          <AnimatedPath
            animatedProps={checkAnimatedProps}
            stroke="#2f6647"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[checkLen, checkLen * 2]}
          />
        </Svg>
      </View>
    </GestureDetector>
  );
}
