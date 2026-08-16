import { useEffect } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import ReanimatedAnimated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hapticSuccess } from '@/lib/haptics';

const AnimatedCircle = ReanimatedAnimated.createAnimatedComponent(Circle);
const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);

function polylineLength(points: Array<{ x: number; y: number }>) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

type SuccessCheckmarkProps = {
  size?: number;
};

/**
 * The "task complete" beat Apple uses everywhere from Setup Assistant to
 * Apple Pay: a ring strokes itself in, a checkmark draws inside it, then a
 * small spring-pop and a success haptic land together. Same three beats,
 * drawn in Vervein's own thin-stroke/gradient language (see CommitmentDial)
 * instead of Apple's solid filled-green disc.
 */
export function SuccessCheckmark({ size = 120 }: SuccessCheckmarkProps) {
  const strokeWidth = size * 0.055;
  const r = size / 2 - strokeWidth;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  const checkSize = r * 0.95;
  const checkPoints = [
    { x: c - checkSize * 0.32, y: c + checkSize * 0.02 },
    { x: c - checkSize * 0.08, y: c + checkSize * 0.28 },
    { x: c + checkSize * 0.34, y: c - checkSize * 0.26 },
  ];
  const checkPath = `M ${checkPoints[0].x} ${checkPoints[0].y} L ${checkPoints[1].x} ${checkPoints[1].y} L ${checkPoints[2].x} ${checkPoints[2].y}`;
  const checkLength = polylineLength(checkPoints);

  const ringProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);
  const pop = useSharedValue(0.85);

  useEffect(() => {
    ringProgress.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    checkProgress.value = withDelay(
      750,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(hapticSuccess)();
      })
    );
    // Grows in alongside the ring, holds flat through the checkmark draw,
    // then a small overshoot bounce right as the checkmark lands — timed to
    // the same 150/600/280 beats as ringProgress/checkProgress above so the
    // "pop" reads as landing exactly when the check finishes, not a beat
    // later.
    pop.value = withSequence(
      withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })),
      withTiming(1, { duration: 280 }),
      withTiming(1.1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })
    );
  }, [checkProgress, pop, ringProgress]);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
  }));

  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: checkLength * (1 - checkProgress.value),
  }));

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <ReanimatedAnimated.View style={[{ width: size, height: size }, groupStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="successRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1F4A31" />
            <Stop offset="100%" stopColor="#5FBE84" />
          </LinearGradient>
        </Defs>

        <Circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />

        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke="url(#successRing)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={ringAnimatedProps}
          transform={`rotate(-90 ${c} ${c})`}
        />

        <AnimatedPath
          d={checkPath}
          stroke="#ffffff"
          strokeWidth={strokeWidth * 0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={checkLength}
          animatedProps={checkAnimatedProps}
        />
      </Svg>
    </ReanimatedAnimated.View>
  );
}
