import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { canvasHairline, useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { hapticImpactLight } from '@/lib/haptics';
import { MOTION_DURATION, ONBOARDING_REVEAL_DELAY_MS, ONBOARDING_REVEAL_STAGGER_MS } from '@/lib/motion';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { AndroidRippleOnAccent, Type, sheenGradient } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme-context';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

// Liquid Glass is reserved for the moments that matter — the EnergyGauge
// dial, account creation, subscribing (paywall.tsx) — so it reads as a
// deliberate cue; entering the app for the first time is one of them.
const isGlassAvailable = isLiquidGlassAvailable();

/**
 * The last stop before the app proper — reached after all-set.tsx. Recaps
 * the real choices that went into the plan (commitment, training days,
 * today's session shape via the real engine's own preview) rather than
 * projecting a synthetic growth curve — the trajectory-bars + "% within a
 * year" version of this screen (backed by the since-deleted
 * potential-score.ts) was cut for the same reasoning as
 * onboarding/potential.tsx and Progress's old "Your Potential" section.
 */
export default function OnboardingTrajectoryScreen() {
  const scale = useCanvasScale();
  const hairline = canvasHairline(scale);
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor, hairline), [colors, hoverWashColor, hairline]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const entering = useFadeInEntering();
  const reducedMotion = useReducedMotion();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  // A brand-new account has no session history yet, so the neutral default
  // (1.0×, never adjusted) is the honest calibration state here — not a
  // storage read away from a real one.
  const preview = computePlanPreview(profile ?? {}, 4, { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION });
  const daysCount = profile?.days ? profile.days.split(',').filter(Boolean).length : 0;
  const commitmentIndex = profile?.commitmentLevel ? Number(profile.commitmentLevel) - 1 : null;
  const commitmentName =
    commitmentIndex !== null ? (COMMITMENT_LEVELS[commitmentIndex]?.name ?? null) : null;

  const handleContinue = () => {
    hapticImpactLight();
    // dismissAll() first — this is the true end of the whole onboarding
    // chain (welcome → ... → trajectory), all still one flat root Stack, so
    // replace() alone would leave every prior step reachable with repeated
    // edge-swipe-backs. Same fix as auth/verify.tsx's and create-account.tsx's
    // matching (tabs) landings.
    router.dismissAll();
    router.replace('/(tabs)' as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={41.52} height={52.31} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={31.82} height={44.75} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Here&apos;s your plan</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Built around what you told us — nothing generic.</Text>

        <ReanimatedAnimated.View
          entering={reducedMotion ? undefined : FadeIn.duration(MOTION_DURATION.slow).delay(ONBOARDING_REVEAL_DELAY_MS)}
          style={styles.highlightsCard}
        >
          <View pointerEvents="none" style={styles.highlightsSheen} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel} maxFontSizeMultiplier={1.3}>Commitment</Text>
            <Text style={styles.highlightValue} maxFontSizeMultiplier={1.2}>{commitmentName ?? 'Not set'}</Text>
          </View>
          <View style={styles.highlightDivider} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel} maxFontSizeMultiplier={1.3}>Training days</Text>
            <Text style={styles.highlightValue} maxFontSizeMultiplier={1.2}>
              {daysCount > 0 ? `${daysCount}x / week` : 'Not set'}
            </Text>
          </View>
          <View style={styles.highlightDivider} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel} maxFontSizeMultiplier={1.3}>Typical session</Text>
            <Text style={styles.highlightValue} maxFontSizeMultiplier={1.2}>
              {preview.exerciseCount} exercises · {preview.durationMin} min
            </Text>
          </View>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.Text
          entering={
            reducedMotion
              ? undefined
              : FadeIn.duration(MOTION_DURATION.slow).delay(ONBOARDING_REVEAL_DELAY_MS + ONBOARDING_REVEAL_STAGGER_MS)
          }
          style={styles.closingLine}
          maxFontSizeMultiplier={1.4}
        >
          Your plan adjusts every time you check in —{' '}
          <Text style={styles.closingLineAccent}>how you feel today shapes what you do today</Text>.
        </ReanimatedAnimated.Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
          android_ripple={AndroidRippleOnAccent}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isGlassAvailable && styles.primaryButtonVisualGlass,
              { transform: [{ scale: ctaPress.scale }] },
            ]}
          >
            {isGlassAvailable ? (
              <GlassView
                pointerEvents="none"
                glassEffectStyle="regular"
                tintColor="#1c3d29"
                style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: 6 }]}
              />
            ) : null}
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
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Enter VerveIn</Text>
            <View style={styles.buttonArrow}>
              <ArrowUpIconGraphic size={24} />
            </View>
          </Animated.View>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string, hairline: number) {
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
    logoMark: {
      position: 'absolute',
      left: 155.68,
      top: 83,
      width: 65.65,
      height: 58.91,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 6.61,
    },
    logoCheck: {
      position: 'absolute',
      left: 33.83,
      top: 0,
    },
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 168,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: Type.heading,
      lineHeight: 27,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 202,
      color: colors.textSecondary,
      fontSize: Type.secondary,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    highlightsCard: {
      position: 'absolute',
      left: 25,
      top: 300,
      width: 325,
      paddingHorizontal: 18,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: hairline,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    highlightsSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '48%',
      ...sheenGradient(colors.surfaceSheen),
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    highlightDivider: {
      height: hairline,
      backgroundColor: colors.surfaceDivider,
    },
    highlightLabel: {
      color: colors.textSecondary,
      fontSize: 11.5,
      fontFamily: 'Geist-Medium',
    },
    highlightValue: {
      color: colors.text,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    closingLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 480,
      paddingHorizontal: 52,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    closingLineAccent: {
      color: colors.accentText,
      fontFamily: 'Geist-Bold',
    },
    // A few px taller than the standard CTA — this is one of the three
    // milestone moments (see isGlassAvailable above) allowed to carry a
    // little more physical weight: entering the app for the first time.
    primaryButtonHit: {
      position: 'absolute',
      left: 46,
      top: 653,
      width: 285,
      height: 44,
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
    primaryButtonVisualGlass: {
      backgroundColor: 'rgba(41,86,58,0.4)',
      borderWidth: 0,
    },
    primaryText: {
      color: '#ffffff',
      fontSize: Type.secondary,
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
