import { useRef } from 'react';
import { Animated, Easing } from 'react-native';

const HOVER_TRANSITION_MS = 150;

/**
 * Cursor-only hover fade (mouse/trackpad) — never fires from touch presses.
 * Wire `onHoverIn`/`onHoverOut` to a Pressable and interpolate `anim` (0→1)
 * into a subtle wash overlay's opacity.
 */
export function useHoverFade() {
  const anim = useRef(new Animated.Value(0)).current;
  const onHoverIn = () => {
    Animated.timing(anim, { toValue: 1, duration: HOVER_TRANSITION_MS, useNativeDriver: true }).start();
  };
  const onHoverOut = () => {
    Animated.timing(anim, { toValue: 0, duration: HOVER_TRANSITION_MS, useNativeDriver: true }).start();
  };
  return { anim, onHoverIn, onHoverOut };
}

/**
 * Press-only "Liquid Glass" feel — separate from hover so a mouse resting on the
 * button never triggers it. Compresses + glows on touch down, flexes past rest and
 * settles on release. Purely transform/opacity so it stays on the native driver.
 */
export function useLiquidPress() {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.004,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(glow, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return { scale, glow, onPressIn, onPressOut };
}
