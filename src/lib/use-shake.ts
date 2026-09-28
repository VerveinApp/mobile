import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * A small horizontal shake — the same "that didn't take" gesture iOS uses
 * for a wrong passcode. Put `shakeStyle` on a Reanimated view and call
 * `shake()` from a handler, alongside the haptic and whatever message says
 * why. Translate only, so text inside stays crisp. Skipped under Reduce
 * Motion; the haptic and the message still carry it.
 */
export function useShake() {
  const reducedMotion = useReducedMotion();
  const x = useSharedValue(0);
  const shake = () => {
    if (reducedMotion) return;
    x.set(
      withSequence(
        withTiming(-8, { duration: 45 }),
        withTiming(8, { duration: 70 }),
        withTiming(-5, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(0, { duration: 50 })
      )
    );
  };
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return { shake, shakeStyle };
}
