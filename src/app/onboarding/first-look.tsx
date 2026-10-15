import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { CanvasScaleContext, canvasHairline, scaleCanvasStyles, useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useCountTo } from '@/lib/use-count-to';
import { AndroidRippleOnAccent, TabularNums, Type, sheenGradient } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';
import { EnergyGauge, type EnergyScore } from '@/components/home/energy-gauge';
import { PlanPeek } from '@/components/plan/plan-peek';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;
// The card lands this long after the screen; once it has, the gauge moves
// itself from Low to Good once, so the plan is seen changing before anyone
// touches it.
const CARD_DELAY = 150;
const DEMO_DELAY = CARD_DELAY + MOTION_DURATION.slow + 400;
// No account exists yet at this point in onboarding, so there's no real
// calibration to read — the neutral default (1.0×, never adjusted) is the
// honest starting point every new user actually has.
const PREVIEW_CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };

/**
 * The payoff screen the entire flow is built around reaching — differentiation
 * demonstrated, not described. No progress bar: the question-answering part
 * of onboarding is done, this is the "here's why it was worth it" moment.
 */
export default function OnboardingFirstLookScreen() {
  const scale = useCanvasScale();
  const hairline = canvasHairline(scale);
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const hoverWashColor = isDark ? '#ffffff' : '#000000';
  const statBlockBorder = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
  const styles = useMemo(
    () => scaleCanvasStyles(createStyles(colors, hoverWashColor, statBlockBorder, hairline), scale),
    [colors, hoverWashColor, statBlockBorder, hairline, scale]
  );

  const params = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
    age?: string;
    duration?: string;
    days?: string;
    commitmentLevel?: string;
  }>();

  const entering = useFadeInEntering();
  const reducedMotion = useReducedMotion();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();
  // FadeInDown's own 25pt rise is a real-point length; scaled so the cards
  // travel as far as they did when the whole canvas was magnified.
  const cardRise = { translateY: 25 * scale };

  // Their own plan at whatever energy they drag to — the same engine the
  // daily check-in runs, on the answers they just gave.
  const [energy, setEnergy] = useState<EnergyScore>(2);
  const touched = useRef(false);
  useEffect(() => {
    if (reducedMotion) return;
    const id = setTimeout(() => {
      if (!touched.current) setEnergy(4);
    }, DEMO_DELAY);
    return () => clearTimeout(id);
  }, [reducedMotion]);
  const handleEnergyChange = (value: EnergyScore) => {
    touched.current = true;
    setEnergy(value);
  };
  const preview = computePlanPreview(params, energy, PREVIEW_CALIBRATION);
  const goodDay = computePlanPreview(params, 4, PREVIEW_CALIBRATION);

  const handleCreateAccount = () => {
    hapticImpactLight();
    saveOnboardingDraft({ step: 9, params });
    router.push({ pathname: '/onboarding/create-account', params } as never);
  };

  return (
    <CanvasScaleContext value={scale}>
    <View style={styles.root}>
      <View style={styles.canvas}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-7', params)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackArrowGraphic color={colors.text} />
        </Pressable>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={41.52} height={52.31} color={colors.text} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={31.82} height={44.75} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Here&apos;s the part that&apos;s different</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Drag your energy and watch your plan change:</Text>

        <ReanimatedAnimated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(MOTION_DURATION.slow).delay(CARD_DELAY).easing(MOTION_EASING.standard).withInitialValues(cardRise)}
          style={styles.card}
        >
          <View pointerEvents="none" style={styles.cardSheen} />
          <Text style={[styles.cardLabel, styles.cardLabelAccent]} maxFontSizeMultiplier={1.2}>Try it</Text>
          <View style={styles.gaugeWrap}>
            <EnergyGauge size={236} value={energy} onChange={handleEnergyChange} />
          </View>
          <LiveStat count={preview.exerciseCount} minutes={preview.durationMin} instant={reducedMotion} styles={styles} />
          <PlanPeek
            exercises={preview.exercises}
            minutes={preview.durationMin}
            goodDayMinutes={energy === 4 ? null : goodDay.durationMin}
            width={311}
          />
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.Text
          entering={reducedMotion ? undefined : FadeIn.duration(MOTION_DURATION.slow).delay(680)}
          style={styles.closingLine}
          maxFontSizeMultiplier={1.4}
        >
          Every day, you get better at reading what you actually have — and using it well.
        </ReanimatedAnimated.Text>

        <Pressable
          style={styles.primaryButtonHit}
          // 38pt tall by design; the slop brings the tap target past 44pt.
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={handleCreateAccount}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
          android_ripple={AndroidRippleOnAccent}
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
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Create your account</Text>
            <View style={styles.buttonArrow}>
              <ArrowUpIconGraphic size={24} />
            </View>
          </Animated.View>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
    </CanvasScaleContext>
  );
}

/**
 * The plan's size, counting to each new value as the gauge moves, so the
 * difference is seen happening. Only this block re-renders per frame. Reduce
 * Motion shows the final numbers straight away; VoiceOver reads the settled
 * values.
 */
function LiveStat({
  count,
  minutes,
  instant,
  styles,
}: {
  count: number;
  minutes: number;
  instant: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const shownCount = useCountTo(count, instant);
  const shownMin = useCountTo(minutes, instant);
  return (
    <View
      style={[styles.cardStatBlock, styles.cardStatBlockAccent]}
      accessible
      accessibilityLabel={`${count} exercises, ${minutes} minutes`}
    >
      <Text style={styles.cardStat} maxFontSizeMultiplier={1.2}>
        {shownCount} <Text style={styles.cardStatUnit}>exercises</Text> · {shownMin}{' '}
        <Text style={styles.cardStatUnit}>min</Text>
      </Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string, statBlockBorder: string, hairline: number) {
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
      top: 188,
      paddingHorizontal: 40,
      color: colors.text,
      fontSize: Type.heading,
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
      fontSize: Type.secondary,
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
      borderWidth: hairline,
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
      ...sheenGradient(colors.surfaceSheen),
    },
    gaugeWrap: {
      marginTop: 10,
      alignItems: 'center',
    },
    cardLabel: {
      color: colors.textSecondary,
      fontSize: Type.micro,
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
    // Tabular so the feeling-good block doesn't resize on every frame of
    // its count-up (the units inherit it).
    cardStat: {
      color: colors.text,
      fontSize: Type.headerTitle,
      fontFamily: 'Geist-Bold',
      ...TabularNums,
    },
    cardStatUnit: {
      color: colors.textTertiary,
      fontSize: Type.secondary,
      fontWeight: '500',
    },
    cardExplanation: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: Type.caption,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    closingLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 672,
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
      top: 720,
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
