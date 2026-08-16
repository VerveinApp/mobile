import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { computePotential } from '@/lib/potential-score';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { RadarChart } from '@/components/onboarding/radar-chart';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * The consent-branch payoff screen — reached only when the user shared
 * biometrics on the consent screen, since these pillar scores need real
 * height/weight/sex/experience data to be honest. Everyone else sees
 * First Look instead (see step-7's branch). No progress bar: this is the
 * payoff, not another question.
 */
export default function OnboardingPotentialScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const params = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    healthConsent?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
    duration?: string;
    days?: string;
    commitmentLevel?: string;
  }>();

  const entering = useFadeInEntering();
  const reducedMotion = useReducedMotion();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const result = computePotential(params);

  // Counts up rather than appearing instantly — timed to land just as the
  // radar chart finishes blooming, so the number and the shape read as one
  // continuous reveal instead of two unrelated animations. Reduced-motion
  // users see the final number immediately instead of counting up to it.
  const [displayOverall, setDisplayOverall] = useState(reducedMotion ? result.overall : 0);
  const [overallAnim] = useState(() => new Animated.Value(reducedMotion ? result.overall : 0));
  useEffect(() => {
    if (reducedMotion) return;
    const id = overallAnim.addListener(({ value }) => setDisplayOverall(Math.round(value)));
    Animated.timing(overallAnim, {
      toValue: result.overall,
      duration: 900,
      delay: 500,
      useNativeDriver: false,
    }).start();
    return () => overallAnim.removeListener(id);
  }, [overallAnim, reducedMotion, result.overall]);

  const handleCreateAccount = () => {
    hapticImpactLight();
    saveOnboardingDraft({ step: 9, params });
    router.push({ pathname: '/onboarding/create-account', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-7', params)}
          hitSlop={12}
        >
          <BackArrowGraphic color={colors.text} />
        </Pressable>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={45.32} height={52.31} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={33.99} height={44.75} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title}>Your estimated potential</Text>
        <Text style={styles.subtitle}>Here&apos;s what Vervein sees.</Text>

        <View style={styles.radarWrap}>
          <RadarChart size={200} data={result.pillars.map((p) => ({ label: p.label, value: p.value }))} />
        </View>

        <View style={styles.overallBlock}>
          <View style={styles.overallValueBlock}>
            <Text style={styles.overallValue}>{displayOverall}%</Text>
          </View>
          <ReanimatedAnimated.Text
            entering={reducedMotion ? undefined : FadeIn.duration(300).delay(650)}
            style={styles.overallLabel}
          >
            Overall Potential
          </ReanimatedAnimated.Text>
        </View>

        <ReanimatedAnimated.Text
          entering={reducedMotion ? undefined : FadeIn.duration(350).delay(950)}
          style={styles.insight}
        >
          With your inputs, you have high potential for{' '}
          <Text style={styles.insightAccent}>
            {result.leadPillars[0]?.toLowerCase()} and {result.leadPillars[1]?.toLowerCase()}
          </Text>
          .
        </ReanimatedAnimated.Text>

        <View style={styles.trajectoryRow}>
          {result.trajectory.map((point, index) => (
            <ReanimatedAnimated.View
              key={point.label}
              entering={reducedMotion ? undefined : FadeIn.duration(300).delay(1100 + index * 150)}
              style={styles.trajectoryPoint}
            >
              <Text style={styles.trajectoryValue}>{point.value}%</Text>
              <Text style={styles.trajectoryLabel}>{point.label}</Text>
              {index < result.trajectory.length - 1 ? <Text style={styles.trajectoryArrow}>→</Text> : null}
            </ReanimatedAnimated.View>
          ))}
        </View>
        <ReanimatedAnimated.Text
          entering={reducedMotion ? undefined : FadeIn.duration(350).delay(1550)}
          style={styles.trajectoryNote}
        >
          Stay consistent and you could reach {result.peak}% within a year.
        </ReanimatedAnimated.Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleCreateAccount}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View style={[styles.primaryButtonVisual, { transform: [{ scale: ctaPress.scale }] }]}>
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
            <Text style={styles.primaryText}>Create your account</Text>
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
    backButton: {
      position: 'absolute',
      left: 11,
      top: 33,
      width: 27,
      height: 27,
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
      top: 152,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.2,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 180,
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    radarWrap: {
      position: 'absolute',
      left: (CANVAS_WIDTH - 200) / 2,
      top: 208,
      width: 200,
      height: 200,
    },
    overallBlock: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 422,
      alignItems: 'center',
    },
    // A hard-edged flat block, not another soft glass surface — the number
    // that matters gets a deliberately different, neobrutalist treatment so
    // it reads as data, not decoration.
    overallValueBlock: {
      paddingHorizontal: 14,
      paddingVertical: 2,
      borderWidth: 2,
      borderRadius: 2,
      borderColor: 'rgba(67,140,99,0.6)',
      backgroundColor: colors.pillBg,
    },
    overallValue: {
      color: colors.text,
      fontSize: 34,
      letterSpacing: -0.6,
      fontFamily: 'Geist-Black',
    },
    overallLabel: {
      marginTop: 2,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontFamily: 'Geist-Medium',
    },
    insight: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 488,
      paddingHorizontal: 44,
      color: colors.textSecondary,
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    insightAccent: {
      color: '#438C63',
      fontFamily: 'Geist-SemiBold',
    },
    trajectoryRow: {
      position: 'absolute',
      left: 24,
      right: 24,
      top: 546,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    trajectoryPoint: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    trajectoryValue: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-Bold',
    },
    trajectoryLabel: {
      marginLeft: 4,
      color: colors.textTertiary,
      fontSize: 9,
      fontFamily: 'Geist-Medium',
    },
    trajectoryArrow: {
      marginLeft: 8,
      color: '#438C63',
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    trajectoryNote: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 580,
      paddingHorizontal: 56,
      color: '#438C63',
      fontSize: 11,
      lineHeight: 16,
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
