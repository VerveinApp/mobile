import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * The payoff screen the entire flow is built around reaching — differentiation
 * demonstrated, not described. No progress bar: the question-answering part
 * of onboarding is done, this is the "here's why it was worth it" moment.
 */
export default function OnboardingFirstLookScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const hoverWashColor = isDark ? '#ffffff' : '#000000';
  const statBlockBorder = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
  const styles = useMemo(
    () => createStyles(colors, hoverWashColor, statBlockBorder),
    [colors, hoverWashColor, statBlockBorder]
  );

  const params = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
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

  // No account exists yet at this point in onboarding, so there's no real
  // calibration to read — the neutral default (1.0×, never adjusted) is the
  // honest starting point every new user actually has.
  const previewCalibration = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };
  const lowEnergy = computePlanPreview(params, 2, previewCalibration);
  const goodEnergy = computePlanPreview(params, 4, previewCalibration);

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

        <Text style={styles.title}>Here&apos;s the part that&apos;s different</Text>
        <Text style={styles.subtitle}>Same plan, two different days:</Text>

        <ReanimatedAnimated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(150).springify().damping(16)}
          style={styles.card}
        >
          <View pointerEvents="none" style={styles.cardSheen} />
          <Text style={styles.cardLabel}>Low energy day</Text>
          <View style={styles.cardStatBlock}>
            <Text style={styles.cardStat}>
              {lowEnergy.exerciseCount} <Text style={styles.cardStatUnit}>exercises</Text> · {lowEnergy.durationMin}{' '}
              <Text style={styles.cardStatUnit}>min</Text>
            </Text>
          </View>
          <Text style={styles.cardExplanation}>{lowEnergy.explanation}</Text>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(380).springify().damping(16)}
          style={[styles.card, styles.cardSecond]}
        >
          <View pointerEvents="none" style={styles.cardSheen} />
          <Text style={[styles.cardLabel, styles.cardLabelAccent]}>Feeling good day</Text>
          <View style={[styles.cardStatBlock, styles.cardStatBlockAccent]}>
            <Text style={styles.cardStat}>
              {goodEnergy.exerciseCount} <Text style={styles.cardStatUnit}>exercises</Text> · {goodEnergy.durationMin}{' '}
              <Text style={styles.cardStatUnit}>min</Text>
            </Text>
          </View>
          <Text style={styles.cardExplanation}>{goodEnergy.explanation}</Text>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.Text
          entering={reducedMotion ? undefined : FadeIn.duration(350).delay(680)}
          style={styles.closingLine}
        >
          This happens automatically, every day. You won&apos;t have to guess.
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

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string, statBlockBorder: string) {
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
      top: 188,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.3,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      // Headline wraps to two lines at this width/weight (188 + 28*2 = 244),
      // so this has to clear that, not just a single-line title.
      top: 254,
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    card: {
      position: 'absolute',
      left: 16,
      top: 284,
      width: 343,
      padding: 16,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    // A static, subtle top-edge highlight — same treatment as every other
    // card surface redesigned this pass.
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '48%',
      backgroundColor: colors.surfaceSheen,
    },
    cardSecond: {
      top: 412,
      borderColor: 'rgba(67,140,99,0.5)',
    },
    cardLabel: {
      color: colors.textSecondary,
      fontSize: 10.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: 'Geist-SemiBold',
    },
    cardLabelAccent: {
      color: '#438C63',
    },
    // A hard-edged flat block, not another soft glass surface — the numbers
    // that matter get a deliberately different, neobrutalist treatment so
    // they read as data, not decoration.
    cardStatBlock: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderWidth: 2,
      borderRadius: 2,
      borderColor: statBlockBorder,
      backgroundColor: colors.pillBg,
    },
    cardStatBlockAccent: {
      borderColor: 'rgba(67,140,99,0.6)',
    },
    cardStat: {
      color: colors.text,
      fontSize: 20,
      fontFamily: 'Geist-Bold',
    },
    cardStatUnit: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
    cardExplanation: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    closingLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 552,
      paddingHorizontal: 48,
      color: colors.text,
      fontSize: 12.5,
      lineHeight: 18,
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
