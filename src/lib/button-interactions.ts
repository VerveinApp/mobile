import { useState } from 'react';
import { Animated, Easing } from 'react-native';
import { ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';

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

/**
 * The touch-down feedback for every plain Pressable that has no glow of its
 * own — rows, cards, pills, header buttons, dialog buttons. BUG FIX: on
 * iPhone most of these gave no visual response at all: useHoverFade only
 * fires for a mouse/trackpad pointer and android_ripple only on Android, so
 * a tap registered as a haptic tick and nothing else. Applied as
 * `style={({ pressed }) => [base, pressed && PRESSED_DIM]}`, iOS's own
 * dim-while-held convention for tappable content.
 */
export const PRESSED_DIM = { opacity: 0.6 } as const;

/** How far a disabled primary button dims — the old static `opacity: 0.5`. */
export const DISABLED_BUTTON_OPACITY = 0.5;

const ENABLED_FADE = {
  duration: MOTION_DURATION.base,
  easing: MOTION_EASING.standard,
  reduceMotion: ReduceMotion.System,
} as const;

/**
 * A primary button's disabled ⇄ enabled dim as a short fade rather than a
 * one-frame snap. Put it on a Reanimated visual view (the Pressable's inner
 * visual, not the Pressable); the first render lands on the right value with
 * no animation. Never on a GlassView's ancestor — that kind of button dims
 * with useDisabledScrimStyle over its content instead.
 */
export function useEnabledFadeStyle(enabled: boolean) {
  return useAnimatedStyle(() => ({
    opacity: withTiming(enabled ? 1 : DISABLED_BUTTON_OPACITY, ENABLED_FADE),
  }));
}

/**
 * The same fade for a button whose visual holds a GlassView (whose own
 * ancestors must never change opacity): a scrim in the card surface colour,
 * laid over the content, fades in to the same 50% dim instead.
 */
export function useDisabledScrimStyle(disabled: boolean) {
  return useAnimatedStyle(() => ({
    opacity: withTiming(disabled ? DISABLED_BUTTON_OPACITY : 0, ENABLED_FADE),
  }));
}
