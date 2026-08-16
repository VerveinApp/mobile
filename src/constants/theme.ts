/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Light mode follows the same grouped-list convention as iOS Settings: a
 * soft light-gray page (systemGroupedBackground, ~#F2F2F7) with white card
 * surfaces on top — not a literal color-inversion of dark mode's near-black
 * cards. Text on both page and card is near-black rather than pure #000000
 * (softer contrast, matches iOS's own label color). Dark mode is unchanged:
 * near-black page, slightly-lighter-black cards. Brand accent colors
 * (green/red/orange and their translucent tints) are shared literals used
 * directly in every screen's styles — they read fine on both a black card
 * and a white one, so they don't need theme tokens of their own.
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
