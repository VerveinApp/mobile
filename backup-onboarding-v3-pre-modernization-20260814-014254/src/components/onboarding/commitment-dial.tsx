import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { hapticSelect } from '@/lib/haptics';

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

/** Point on the ring at `angleDeg` clockwise from 12 o'clock. */
function pointAt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
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
 */
export function CommitmentDial({ size = 220, canvasScale = 1, value, onChange, levelLabel }: CommitmentDialProps) {
  // Plain-number source of truth for the gesture math (Animated.Value has no
  // synchronous getter); the Animated.Value below mirrors it for rendering
  // and drives the release-snap easing.
  const sweepRef = useRef(0);
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    const id = sweepAnim.addListener(({ value: v }) => setSweep(v));
    return () => sweepAnim.removeListener(id);
  }, [sweepAnim]);

  const lastAngleRef = useRef(0);
  const lastIndexRef = useRef<number | null>(null);

  const half = (Platform.OS === 'web' ? size * canvasScale : size) / 2;
  const angleAt = (locationX: number, locationY: number) => {
    const dx = locationX - half;
    const dy = locationY - half;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  const snapTo = (idx: number) => {
    const snapped = idx * STEP;
    Animated.timing(sweepAnim, { toValue: snapped, duration: 160, useNativeDriver: false }).start();
    sweepRef.current = snapped;
  };

  /** Used by VoiceOver/TalkBack increment/decrement — the drag path snaps and reports separately. */
  const setIndex = (idx: number) => {
    const clamped = clamp(idx, 0, STOP_INTERVALS);
    lastIndexRef.current = clamped;
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
          onChange(idx);
        }
      },
      onPanResponderMove: (evt) => {
        const angle = angleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        const delta = shortestDelta(lastAngleRef.current, angle);
        lastAngleRef.current = angle;

        sweepRef.current = clamp(sweepRef.current + delta, 0, SWEEP_RANGE);
        sweepAnim.setValue(sweepRef.current);

        const idx = indexFromSweep(sweepRef.current);
        if (lastIndexRef.current !== idx) {
          lastIndexRef.current = idx;
          hapticSelect();
          onChange(idx);
        }
      },
      onPanResponderRelease: () => snapTo(indexFromSweep(sweepRef.current)),
      onPanResponderTerminate: () => snapTo(indexFromSweep(sweepRef.current)),
    })
  ).current;

  const c = size / 2;
  const ringR = size * 0.4;
  const strokeWidth = size * 0.075;
  const handleR = size * 0.075;

  const endAngle = START_ANGLE + sweep;
  const isSet = value !== null;
  const handlePoint = pointAt(c, c, ringR, endAngle);
  const checkSize = handleR * 1.15;

  return (
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
      {...panResponder.panHandlers}
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

        {sweep > 0.5 ? (
          <Path
            d={describeArc(c, c, ringR, START_ANGLE, endAngle)}
            stroke="url(#commitmentArc)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        <Circle
          cx={handlePoint.x}
          cy={handlePoint.y}
          r={handleR}
          fill={isSet ? '#ffffff' : '#0C0C0C'}
          stroke={isSet ? '#ffffff' : '#676767'}
          strokeWidth={1}
        />
        {isSet ? (
          <Path
            d={`M ${handlePoint.x - checkSize * 0.32} ${handlePoint.y + checkSize * 0.02}
                L ${handlePoint.x - checkSize * 0.08} ${handlePoint.y + checkSize * 0.28}
                L ${handlePoint.x + checkSize * 0.34} ${handlePoint.y - checkSize * 0.26}`}
            stroke="#2f6647"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}
