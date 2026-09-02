import { router } from 'expo-router';
import { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * The app's true first screen — reached only by a fresh user with no draft
 * and no completed profile (see the entry router in (tabs)/index.tsx). Sets
 * the frame before onboarding asks anything: same brand lockup as the
 * account-creation screen at the other end of the flow, so the identity
 * bookends the whole experience rather than only showing up at signup.
 */
export default function OnboardingWelcomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const entering = useFadeInEntering();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const handleGetStarted = () => {
    hapticImpactLight();
    router.push('/onboarding' as never);
  };

  // Reuses the exact same safe path handleSignOut (settings/index.tsx) sends
  // people through: create-account.tsx with no onboarding params, so
  // verify.tsx's hasCompletedOnboarding() check decides what happens next —
  // straight to the main app if this device already has a local profile
  // (unlikely here, since this screen only shows without one, but still
  // correct if it somehow does), onboarding otherwise. Covers a fresh
  // install where someone already has an account from another device.
  const handleSignIn = () => {
    hapticImpactLight();
    router.push('/onboarding/create-account' as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <View style={styles.brandRow} pointerEvents="none">
          <View style={styles.iconWrap}>
            <View style={styles.brandAccent}>
              <LogoMarkAccentGraphic width={35.8156} height={45.1325} color={colors.text} />
            </View>
            <View style={styles.brandMark}>
              <LogoMarkGraphic width={27.2695} height={38.3516} color={colors.text} />
            </View>
          </View>
          <View style={styles.brandWordmark}>
            <WordmarkTextGraphic height={27.25} color={colors.text} />
          </View>
        </View>

        <Text style={styles.kicker} maxFontSizeMultiplier={1.2}>Adaptive Fitness Engine</Text>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {'Fitness built around\n'}
          <Text style={styles.titleAccent}>your journey.</Text>
        </Text>

        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          {'Pacing is a skill.\n'}
          We&apos;re the coach for it.
        </Text>

        <Text style={styles.teaser} maxFontSizeMultiplier={1.4}>See your plan adapt to how you feel — before you sign up.</Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleGetStarted}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View
            style={[styles.primaryButtonVisual, { transform: [{ scale: ctaPress.scale }] }]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: ctaHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: ctaPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
              ]}
            />
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Get started</Text>
            <View style={styles.buttonArrow}>
              <ArrowUpIconGraphic size={24} />
            </View>
          </Animated.View>
        </Pressable>

        <Pressable style={styles.signInHit} onPress={handleSignIn} hitSlop={8}>
          <Text style={styles.signInText} maxFontSizeMultiplier={1.3}>
            {'Already have an account? '}
            <Text style={styles.signInTextBold}>Sign in</Text>
          </Text>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    fadeLayer: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    // 25% larger than the original 116×41 lockup, recentered around the
    // same visual midpoint. A real flex row (not a fixed-width absolute
    // box) so centering is based on the wordmark's actual rendered width —
    // it's live Text now, not a fixed-width SVG, so a hand-calculated box
    // width would silently drift from true-center as font metrics render.
    // alignItems: 'flex-end' bottom-aligns the icon and wordmark exactly
    // like the old hand-tuned top offsets did, but driven by real layout.
    brandRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 254.88,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    // marginBottom compensates for WordmarkTextGraphic being a real <Text>,
    // not a tightly-cropped SVG: its box height is the full font lineHeight
    // (~37.3pt for this cap-height), so ~10.29pt of it is invisible descender
    // space below the actual baseline. Bottom-aligning raw boxes (flex-end)
    // was dragging the icon's V-point 10.29pt below where the letters sit —
    // this margin makes flex-end align the V to the true baseline instead,
    // matching create-account.tsx's fixed-position lockup (which already
    // gets this right by coincidence of its hand-tuned numbers).
    iconWrap: {
      width: 56.45,
      height: 50.79,
      marginBottom: 10.29,
    },
    brandAccent: {
      position: 'absolute',
      left: 0,
      top: 5.66,
    },
    brandMark: {
      position: 'absolute',
      left: 29.18,
      top: 0,
    },
    // Box-position math against Figma's CSS dump said -15.42 was correct,
    // but that assumed the wordmark SVG's left-bearing matches Figma's live
    // text layer. It doesn't — pixel-diffing a real Figma render against a
    // live simulator screenshot showed -15.42 fuses the icon into the "e"
    // with zero gap, while Figma keeps a small visible gap. Tuned against
    // that ground truth instead of the box math.
    //
    // Follow-up: a true nearest-point pixel measurement (not a column scan)
    // showed -11 still left a ~9.16pt gap on device — more than double
    // Figma's real ~4.0pt gap between the same two shapes. -16.16 closes it
    // to match.
    brandWordmark: {
      marginLeft: -16.16,
    },
    kicker: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 312,
      color: colors.textSecondary,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 348,
      paddingHorizontal: 48,
      color: colors.text,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    titleAccent: {
      color: '#2f6647',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 432,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    teaser: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 492,
      paddingHorizontal: 64,
      color: '#438C63',
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    primaryButtonHit: {
      position: 'absolute',
      left: 46,
      top: 656,
      width: 285,
      height: 38,
    },
    signInHit: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 706,
      alignItems: 'center',
    },
    signInText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    signInTextBold: {
      color: colors.text,
      fontFamily: 'Geist-Bold',
      textDecorationLine: 'underline',
    },
    primaryButtonVisual: {
      width: '100%',
      height: '100%',
      backgroundColor: '#29563a',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      color: '#ffffff',
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    buttonArrow: {
      position: 'absolute',
      right: 14,
      top: 6,
      transform: [{ rotate: '90deg' }],
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
      zIndex: -1,
    },
  });
}
