import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { hapticImpactLight } from '@/lib/haptics';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { computePotential } from '@/lib/potential-score';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import { getProfile, type UserProfile } from '@/lib/user-profile';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { TrajectoryBars } from '@/components/onboarding/trajectory-bars';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

// Liquid Glass is otherwise reserved for exactly one place (the EnergyGauge
// dial) plus account creation, so it reads as a deliberate "this moment
// matters" cue — entering the app for the first time is the third.
const isGlassAvailable = isLiquidGlassAvailable();

/**
 * The last stop before the app proper — reached after all-set.tsx,
 * regardless of which onboarding branch (health-consent/potential or
 * first-look) the user took, since both converge at create-account before
 * this point. Runs on the same placeholder potential-score.ts engine as the
 * mid-onboarding Potential screen (see that file's own doc comment) — swap
 * both together when the real engine is ready, not just this screen.
 */
export default function OnboardingTrajectoryScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const entering = useFadeInEntering();
  const reducedMotion = useReducedMotion();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const result = computePotential(profile ?? {});
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
    router.replace('/(tabs)' as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={45.32} height={52.31} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={33.99} height={44.75} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title}>Your growth trajectory</Text>
        <Text style={styles.subtitle}>Here&apos;s what staying consistent looks like.</Text>

        <View style={styles.barsWrap}>
          <TrajectoryBars points={result.trajectory} />
        </View>

        <ReanimatedAnimated.View
          entering={reducedMotion ? undefined : FadeIn.duration(350).delay(950)}
          style={styles.highlightsCard}
        >
          <View pointerEvents="none" style={styles.highlightsSheen} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Commitment</Text>
            <Text style={styles.highlightValue}>{commitmentName ?? 'Not set'}</Text>
          </View>
          <View style={styles.highlightDivider} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Training days</Text>
            <Text style={styles.highlightValue}>{daysCount > 0 ? `${daysCount}x / week` : 'Not set'}</Text>
          </View>
          <View style={styles.highlightDivider} />
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Typical session</Text>
            <Text style={styles.highlightValue}>
              {preview.exerciseCount} exercises · {preview.durationMin} min
            </Text>
          </View>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.Text
          entering={reducedMotion ? undefined : FadeIn.duration(350).delay(1150)}
          style={styles.closingLine}
        >
          Stay consistent and you could reach{' '}
          <Text style={styles.closingLineAccent}>{result.peak}%</Text> within a year.
        </ReanimatedAnimated.Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
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
            <Text style={styles.primaryText}>Enter Vervein</Text>
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
    logoMark: {
      position: 'absolute',
      left: 153,
      top: 83,
      width: 71,
      height: 58.91,
    },
    logoAccent: {
      position: 'absolute',
      left: 0,
      top: 6.61,
    },
    logoCheck: {
      position: 'absolute',
      left: 37.01,
      top: 0,
    },
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 168,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: 22,
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
      fontSize: 12,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    barsWrap: {
      position: 'absolute',
      left: (CANVAS_WIDTH - 280) / 2,
      top: 236,
      width: 280,
    },
    highlightsCard: {
      position: 'absolute',
      left: 25,
      top: 440,
      width: 325,
      paddingHorizontal: 18,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
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
      backgroundColor: colors.surfaceSheen,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    highlightDivider: {
      height: StyleSheet.hairlineWidth,
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
      top: 566,
      paddingHorizontal: 52,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    closingLineAccent: {
      color: '#5FBE84',
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
