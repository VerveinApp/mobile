import { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';

/**
 * Shared transition system for the Vervein auth/onboarding flow: an extremely
 * quick, subtle fade-in on the screen being navigated to. No sliding, no
 * scaling, no bounce, no glow/blur — just opacity. Apply the same hook on any
 * future onboarding screen to keep the motion consistent across the flow.
 *
 * Uses Reanimated's `entering` layout-animation API (rather than a manual
 * useEffect + shared value driving opacity) because `entering` is built to
 * apply before the very first paint of a newly-mounted view — a manual
 * approach can race the native screen container's own mount and end up
 * painting at full opacity for a frame before the animation ever starts,
 * which reads as no transition at all.
 *
 * Returns `undefined` when the OS reduced-motion preference is on, so the
 * screen just appears instantly instead of animating.
 */
export function useFadeInEntering() {
  const reduced = useReducedMotion();
  if (reduced) return undefined;
  return FadeIn.duration(180).easing(Easing.out(Easing.quad));
}
