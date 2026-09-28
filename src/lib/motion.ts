import { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

/**
 * Shared animation vocabulary — durations and easing curves meant to be
 * reused instead of every component hand-picking its own close-but-not-
 * quite-matching number (a real audit of this codebase found 20+ distinct
 * duration values in use, several pairs of them serving the identical
 * purpose a few milliseconds apart). Not a claim that every animation must
 * pull from here: a deliberately choreographed one-off sequence
 * (success-checkmark.tsx's ring+overshoot, animated-icon.tsx's splash
 * keyframes) stays hand-tuned on purpose — normalizing those into generic
 * tokens would flatten a real design choice, not fix an inconsistency. This
 * is for the common case: a fade, a reveal, or a loop that's conceptually
 * the same kind of motion somewhere else in the app and should feel like it.
 */
export const MOTION_DURATION = {
  /** Small, immediate state changes — an error message appearing, a quick expand/collapse. */
  fast: 150,
  /** The standard cross-fade — screen-mount fades (useFadeInEntering), check-in's own state-to-state transitions. */
  base: 180,
  /** A calmer reveal than the standard cross-fade for an earned/notable
   * moment — session-complete's milestone count and coaching/pacing notes —
   * without the full weight of onboarding's own delayed reveal beat. */
  emphasis: 240,
  /** A deliberate, noticeable reveal beat — onboarding's delayed title/subtitle sequences. */
  slow: 350,
  /** One direction of an ambient breathing/loading loop (skeleton pulse, energy gauge idle glow). */
  pulse: 700,
} as const;

export const MOTION_EASING = {
  /** This app's one standard curve for fades/reveals. */
  standard: Easing.out(Easing.quad),
  /** The loop curve for an ambient pulse's back-and-forth motion. */
  pulse: Easing.inOut(Easing.quad),
} as const;

/**
 * Onboarding's shared "wait, then reveal the title, then reveal the
 * subtitle a beat later" sequence (all-set.tsx, trajectory.tsx) — one
 * definition instead of two adjacent screens tuning the identical
 * conceptual pause to slightly different numbers.
 */
export const ONBOARDING_REVEAL_DELAY_MS = 1000;
export const ONBOARDING_REVEAL_STAGGER_MS = 180;

/**
 * State that changes while a native pop is still sliding back (finishing a
 * session and landing on Home or Progress, whose focus reload fires the
 * moment router.back() dispatches) waits this long before animating, so the
 * change is seen landing rather than finished mid-slide.
 */
export const RETURN_REVEAL_DELAY_MS = 250;

/**
 * Deleted/archived list rows (swipe-to-delete on notes and every history
 * screen) fade out while the rows below spring up into the gap — they used
 * to vanish instantly and the list snapped shut. Same spring as check-in's
 * exercise list. Reanimated's layout animations already honor the system
 * Reduce Motion setting on their own.
 */
export const LIST_ROW_LAYOUT = LinearTransition.springify(280).dampingRatio(0.8);
export const LIST_ROW_EXITING = FadeOut.duration(MOTION_DURATION.fast).easing(MOTION_EASING.standard);
/** The entering half of the pair — a newly revealed option or row fades in
 * while LIST_ROW_LAYOUT springs everything below it out of the way. */
export const LIST_ROW_ENTERING = FadeIn.duration(MOTION_DURATION.base).easing(MOTION_EASING.standard);
