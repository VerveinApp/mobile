import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { MOTION_DURATION } from '@/lib/motion';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { AndroidRippleOnAccent, Type } from '@/constants/theme';
import { useAppTheme } from '@/lib/theme-context';
import {
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { CommitmentDial } from '@/components/onboarding/commitment-dial';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { COMMITMENT_LEVELS } from '@/lib/commitment-levels';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export default function OnboardingCommitmentScreen() {
  const scale = useCanvasScale();
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const {
    name,
    goal,
    experience,
    environment,
    verifiedEmail,
    healthConsent,
    sex,
    heightCm,
    weightKg,
    age,
    duration,
    days,
    commitmentLevel: incomingCommitmentLevel,
  } = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    verifiedEmail?: string;
    healthConsent?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
    age?: string;
    duration?: string;
    days?: string;
    commitmentLevel?: string;
  }>();

  const baseParams = {
    name: name ?? '',
    goal: goal ?? '',
    experience: experience ?? '',
    environment: environment ?? '',
    verifiedEmail: verifiedEmail ?? '',
    healthConsent: healthConsent ?? 'false',
    sex: sex ?? '',
    heightCm: heightCm ?? '',
    weightKg: weightKg ?? '',
    age: age ?? '',
    duration: duration ?? '',
    days: days ?? '',
  };

  // Arriving here by going back from the payoff screen carries the prior
  // commitment level forward — seed from it instead of resetting the dial.
  const seededIndex = incomingCommitmentLevel ? Number(incomingCommitmentLevel) - 1 : null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    seededIndex !== null && seededIndex >= 0 && seededIndex < COMMITMENT_LEVELS.length ? seededIndex : null
  );

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const isUnselected = selectedIndex === null;
  const selected = selectedIndex !== null ? COMMITMENT_LEVELS[selectedIndex] : null;

  const handleBuildPlan = () => {
    if (selectedIndex === null) return;
    hapticImpactLight();
    // commitmentLevel (1–8) rides forward alongside every prior answer.
    // Onboarding's question-answering is done, but the flow continues
    // through the payoff screen and account creation, so the draft stays
    // alive (now pointing at First Look) rather than being cleared here.
    const params = { ...baseParams, commitmentLevel: String(selectedIndex + 1) };
    // Both branches converge on First Look now — the consent-only "estimated
    // potential" payoff (radar + % + trajectory bars, onboarding/potential.tsx)
    // was cut: a fluctuating-capacity user being told "you're at 54% of your
    // potential" on a bad day is the same performance-guilt frame this
    // product exists to reject, no matter how honest the underlying
    // computation is. First Look demonstrates the same real adaptation
    // (today's actual engine output at two energy levels) without scoring
    // anyone against an ideal.
    saveOnboardingDraft({ step: 8, params });
    router.push({ pathname: '/onboarding/first-look', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <OnboardingProgress step={7} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-6', baseParams)}
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

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>How much can you commit?</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Your plan should fit your life, not take it over.</Text>

        <View style={styles.dialWrap}>
          <CommitmentDial
            size={220}
            canvasScale={scale}
            value={selectedIndex}
            onChange={(index) => setSelectedIndex(index)}
            levelLabel={selected?.name}
          />
        </View>

        <View style={styles.readout}>
          {selected ? (
            <ReanimatedAnimated.View key={selectedIndex} entering={FadeIn.duration(MOTION_DURATION.fast)}>
              <Text style={styles.readoutLevel} maxFontSizeMultiplier={1.1}>
                {selectedIndex! + 1} <Text style={styles.readoutLevelMuted}>/ 8</Text>
              </Text>
              <Text style={styles.readoutName} maxFontSizeMultiplier={1.3}>{selected.name}</Text>
              {selected.quote ? <Text style={styles.readoutQuote} maxFontSizeMultiplier={1.4}>{selected.quote}</Text> : null}
            </ReanimatedAnimated.View>
          ) : (
            <Text style={styles.readoutPrompt} maxFontSizeMultiplier={1.3}>Turn the dial to set your commitment.</Text>
          )}
        </View>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleBuildPlan}
          disabled={isUnselected}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
          android_ripple={AndroidRippleOnAccent}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isUnselected && styles.primaryButtonDisabled,
              { transform: [{ scale: continuePress.scale }] },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: continueHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: continuePress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
              ]}
            />
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Build my plan →</Text>
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
    // CONFIRMED INTENTIONAL (checked in a later full-app audit, previously
    // flagged and left unresolved): steps 2-6 all match exactly on title
    // size/weight (Type.headerTitle, Geist-SemiBold, no letterSpacing).
    // This step diverges on three properties at once — larger (Type.heading),
    // bolder (Geist-Bold), and tighter tracking (letterSpacing: -0.4) — which
    // is what deliberate emphasis looks like, not drift (drift is usually
    // one stray value, not three coordinated ones). This is the final
    // onboarding step, right before "Build my plan" — the extra weight here
    // is the climactic-moment treatment, not an inconsistency to fix.
    title: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 188,
      paddingHorizontal: 32,
      color: colors.text,
      fontSize: Type.heading,
      lineHeight: 27,
      letterSpacing: -0.4,
      textAlign: 'center',
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 224,
      paddingHorizontal: 32,
      color: colors.textSecondary,
      fontSize: Type.caption,
      lineHeight: 16.5,
      textAlign: 'center',
      fontFamily: 'Geist-Regular',
    },
    dialWrap: {
      position: 'absolute',
      left: (CANVAS_WIDTH - 220) / 2,
      top: 280,
      width: 220,
      height: 220,
    },
    readout: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 522,
      alignItems: 'center',
    },
    readoutLevel: {
      color: colors.text,
      fontSize: 40,
      letterSpacing: -0.8,
      fontFamily: 'Geist-Black',
      textAlign: 'center',
    },
    readoutLevelMuted: {
      color: colors.textTertiary,
      fontSize: 15,
      fontWeight: '500',
    },
    readoutName: {
      marginTop: 2,
      color: '#438C63',
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    readoutQuote: {
      marginTop: 8,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: Type.micro,
      lineHeight: 15,
      fontFamily: 'Geist-Regular',
      textAlign: 'center',
    },
    readoutPrompt: {
      color: colors.textTertiary,
      fontSize: Type.caption,
      fontFamily: 'Geist-Medium',
      textAlign: 'center',
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
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryText: {
      color: '#ffffff',
      fontSize: Type.secondary,
      fontFamily: 'Geist-SemiBold',
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
      zIndex: -1,
    },
  });
}
