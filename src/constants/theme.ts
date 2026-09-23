/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Light mode follows the same grouped-list convention as iOS Settings: a
 * soft light-gray page (systemGroupedBackground, ~#F2F2F7) with white card
 * surfaces on top — not a literal color-inversion of dark mode's near-black
 * cards. Text on both page and card is near-black rather than pure #000000
 * (softer contrast, matches iOS's own label color). Dark mode is unchanged:
 * near-black page, slightly-lighter-black cards. Brand accent colors
 * (green/red/orange and their translucent tints) are shared literals used
 * directly in every screen's styles for backgrounds/icon tints — those read
 * fine on both a black card and a white one, so they don't need theme
 * tokens of their own. TEXT set in the brand green is the one real
 * exception — see accentText below, added after a WCAG audit found the
 * literal green fails contrast badly on a white surface.
 */
export const Colors = {
  light: {
    text: '#111111',
    background: '#F2F2F7',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#6b6b6b',
    textTertiary: '#8a8a8a',
    textQuaternary: '#a8a8a8',
    surface: '#FFFFFF',
    surfaceBorder: 'rgba(0,0,0,0.08)',
    surfaceDivider: 'rgba(0,0,0,0.07)',
    surfaceSheen: 'rgba(0,0,0,0.015)',
    badgeBg: 'rgba(0,0,0,0.05)',
    pillBg: '#F2F2F4',
    pillBorder: 'rgba(0,0,0,0.08)',
    glassBg: 'rgba(0,0,0,0.04)',
    glassBorder: 'rgba(0,0,0,0.12)',
    iconMuted: '#6b6b6b',
    iconFaint: '#a0a0a0',
    // WCAG AA FIX (found in an accessibility audit): the brand green
    // (#5FBE84, still used everywhere else as a background/icon-tint
    // literal) is only 2.29:1 against a white surface — badly fails AA's
    // 4.5:1 text-contrast minimum. It was never a theme token before this
    // (see accentText's own dark-mode comment for why), so every screen
    // used the literal directly regardless of theme. This darker shade
    // (4.70:1 against #FFFFFF) is for TEXT set in the brand green only —
    // backgrounds/icon tints keep the original #5FBE84 literal, since
    // those aren't subject to the same text-contrast rule.
    accentText: '#358253',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#9a9a9a',
    textTertiary: '#7a7a7a',
    textQuaternary: '#4a4a4a',
    surface: '#0C0C0C',
    surfaceBorder: 'rgba(255,255,255,0.1)',
    surfaceDivider: 'rgba(255,255,255,0.08)',
    surfaceSheen: 'rgba(255,255,255,0.025)',
    badgeBg: 'rgba(255,255,255,0.06)',
    pillBg: '#141414',
    pillBorder: '#2a2a2a',
    glassBg: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.12)',
    iconMuted: '#9a9a9a',
    iconFaint: '#5a5a5a',
    // The original brand green already passes AA here (8.56:1 against
    // #0C0C0C) — kept unchanged, so accentText only actually diverges from
    // the shared literal in light mode.
    accentText: '#5FBE84',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * A real font-size scale — added after a later full-app audit found 30+
 * distinct fontSize values in use across the app, several of them clearly
 * unintentional drift (two labels serving the identical visual role a half-
 * pixel apart, e.g. profile.tsx's own goalEyebrow at 10 next to
 * sectionKicker's 11 for the same "small-caps eyebrow" role — nobody chose
 * that difference, it just accumulated). This is deliberately NOT a new
 * design language: every value here already existed as one of the app's
 * own dominant, most-repeated sizes — this only gives the handful of real
 * roles a shared name so future screens draw from one small set instead of
 * each hand-picking its own close-but-not-quite-matching number, the same
 * fix MOTION_DURATION (motion.ts) already applied to animation timings.
 * Adopted so far in profile.tsx as the first, fully-converted example —
 * the remaining screens still use their own literal fontSize values and
 * are real, larger follow-up work, not done here.
 */
export const Type = {
  /** Smallest captions — footnotes, maintenance-calorie caption, log-row subtitles. */
  micro: 10.5,
  /** Small-caps eyebrows/section kickers, badges, secondary row notes. */
  caption: 11,
  /** Secondary supporting text under a heading — email, muted stat suffixes. */
  secondary: 12,
  /** Default body/row text — the single most common size in the app. */
  body: 13,
  /** Slightly larger body — modal/sheet inputs, emphasized inline text. */
  bodyLarge: 14,
  /** Modal/sheet titles. */
  subtitle: 16,
  /** In-card large stat numbers (rings, single big values). */
  stat: 18,
  /** Screen-level names/titles. */
  title: 19,
  /** Nav header titles — see the app-wide headerTitle bump this same audit already applied. */
  headerTitle: 20,
  /** A full page's own greeting/heading — Home's "Good morning" — distinct
   * from title/headerTitle/display, all real, already-observed sizes in
   * use for genuinely different roles, not collapsed into one another. */
  heading: 22,
  /** Large hero numbers — avatar initials, big display stats. */
  display: 24,
} as const;

// A number that IS the content (ring values, ruler readouts, stat cards)
// gets this — every digit the same width, so the value doesn't visually
// jitter as it changes and a column of numbers stays aligned. This is a
// spacing feature Geist itself provides for its own digits, not a
// different typeface, so it layers onto any existing Type/fontFamily
// combination rather than replacing it. Deliberately NOT applied to prose
// that merely contains a number (a date, a count inside a sentence) —
// only to a value standing alone as the thing being read.
export const TabularNums: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

// Android's own native ripple feedback (Pressable's `android_ripple` prop) —
// a no-op object on iOS, since iOS's Pressable implementation never reads
// this prop at all. Tinted with the brand green rather than left as
// Android's own default gray, so the one interaction cue every single
// tappable surface produces still reads as VerveIn's own, not a generic
// Material app's. `borderless: false` (the default) lets the ripple clip to
// whatever border-radius the pressable's own container already has.
export const AndroidRipple = { color: 'rgba(95,190,132,0.24)' };

// Same brand-green logic as AndroidRipple, one level darker/more opaque —
// for a ripple over a surface that's already tinted green itself (a primary
// CTA), where the lighter default ripple reads as barely-there.
export const AndroidRippleOnAccent = { color: 'rgba(255,255,255,0.2)' };

// Android-only elevation (the `elevation` style prop) replacing this app's
// iOS-native hairline-border card convention — RN's `elevation` has no
// effect on iOS at all (iOS reads shadowColor/shadowOffset/shadowOpacity/
// shadowRadius instead, untouched here), so spreading this into a card
// style is safe by construction, not something that needs its own
// Platform.OS guard. Low values on purpose (Material's own scale goes to
// 24dp for dialogs) — this app's existing look is quiet and flat, and a
// heavy drop shadow would read as a generic Material template rather than
// this app's own restrained aesthetic.
export const AndroidCardElevation = { elevation: 3 };
export const AndroidRaisedElevation = { elevation: 6 };

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * The top-down card sheen as a real gradient, not a flat block. BUG FIX:
 * every *Sheen overlay used to be a solid surfaceSheen rectangle covering
 * the card's top 30–55%, and its bottom edge drew a visible hard line
 * straight across the card (through the Today card's title, between Your
 * Plan's rows) — read as a rendering seam, not a sheen. Fading to
 * transparent keeps the same light-from-above feel with no edge.
 */
export function sheenGradient(sheenColor: string): Pick<ViewStyle, 'experimental_backgroundImage'> {
  return { experimental_backgroundImage: `linear-gradient(180deg, ${sheenColor} 0%, transparent 100%)` };
}
