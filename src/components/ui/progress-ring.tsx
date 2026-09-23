import { useEffect } from 'react';
import ReanimatedAnimated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  size?: number;
  strokeWidth?: number;
  /** 0–1, clamped — never trusts a caller's own division to already be in range. */
  progress: number;
  color: string;
  trackColor: string;
};

/**
 * A circular progress indicator — same "solid stroke over a flat track"
 * language Sparkline's own filled mode and RadarChart's polygon fill
 * already use, just wrapped into a ring. Unlike EnergyGauge/CommitmentDial
 * (both interactive, gesture-driven controls with their own selection
 * state), this is read-only — it only ever reflects a value a caller
 * already computed, never accepts input.
 *
 * The arc sweeps to its value (and to any new value later) on the same
 * cubic ease-out as the app's other charts, instead of appearing already
 * drawn. Instant under Reduce Motion.
 */
export function ProgressRing({ size = 58, strokeWidth = 6, progress, color, trackColor }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const reducedMotion = useReducedMotion();
  const drawn = useSharedValue(reducedMotion ? clamped : 0);
  useEffect(() => {
    drawn.value = reducedMotion
      ? clamped
      : withDelay(150, withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, drawn, reducedMotion]);

  const arcAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - drawn.value),
    // A round cap at zero length still draws a dot — hide the arc until
    // there's something to show.
    opacity: drawn.value > 0.001 ? 1 : 0,
  }));

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        rotation={-90}
        origin={`${center}, ${center}`}
        animatedProps={arcAnimatedProps}
      />
    </Svg>
  );
}
