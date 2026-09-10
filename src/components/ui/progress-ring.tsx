import Svg, { Circle } from 'react-native-svg';

type ProgressRingProps = {
  size?: number;
  strokeWidth?: number;
  /** 0–1, clamped — never trusts a caller's own division to already be in range. */
  progress: number;
  color: string;
  trackColor: string;
};

/**
 * A static circular progress indicator — same "solid stroke over a flat
 * track" language Sparkline's own filled mode and RadarChart's polygon fill
 * already use, just wrapped into a ring. Unlike EnergyGauge/CommitmentDial
 * (both interactive, gesture-driven controls with their own selection
 * state), this is read-only — it only ever reflects a value a caller
 * already computed, never accepts input.
 */
export function ProgressRing({ size = 58, strokeWidth = 6, progress, color, trackColor }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      {clamped > 0 ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      ) : null}
    </Svg>
  );
}
