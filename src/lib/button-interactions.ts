import { useState } from 'react';
import { Animated, Easing } from 'react-native';

const HOVER_TRANSITION_MS = 150;

/**
 * Cursor-only hover fade (mouse/trackpad) — never fires from touch presses.
 * Wire `onHoverIn`/`onHoverOut` to a Pressable and interpolate `anim` (0→1)
 * into a subtle wash overlay's opacity.
 */
export function useHoverFade() {
  const [anim] = useState(() => new Animated.Value(0));
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
 * button never triggers it. Just the glow now, no scale: transform-scaling a
 * text-containing layer makes iOS smooth-scale the existing rasterized bitmap
 * instead of re-rendering crisp text, which read as a brief blur on every
 * press — dated, not premium. `scale` is kept in the return value (pinned at
 * 1) so every existing `transform: [{ scale: press.scale }]` call site stays
 * valid as a harmless no-op instead of needing a wider edit.
 */
export function useLiquidPress() {
  const [scale] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));

  const onPressIn = () => {
    Animated.timing(glow, {
      toValue: 1,
      duration: 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(glow, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return { scale, glow, onPressIn, onPressOut };
}
