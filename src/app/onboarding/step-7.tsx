import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
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
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const hoverWashColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const { name, goal, experience, environment, healthConsent, sex, heightCm, weightKg, duration, days, commitmentLevel: incomingCommitmentLevel } =
    useLocalSearchParams<{
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

  const baseParams = {
    name: name ?? '',
    goal: goal ?? '',
    experience: experience ?? '',
    environment: environment ?? '',
    healthConsent: healthConsent ?? 'false',
    sex: sex ?? '',
    heightCm: heightCm ?? '',
    weightKg: weightKg ?? '',
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
    // alive (now pointing at whichever payoff screen comes next) rather
    // than being cleared here.
    const params = { ...baseParams, commitmentLevel: String(selectedIndex + 1) };
    // The richer "estimated potential" payoff needs real biometrics to be
    // honest — only shown to users who actually consented to share them.
    // Everyone else sees the adaptive First Look demo instead, which needs
    // no health data at all.
    if (healthConsent === 'true') {
      saveOnboardingDraft({ step: 10, params });
      router.push({ pathname: '/onboarding/potential', params } as never);
    } else {
      saveOnboardingDraft({ step: 8, params });
      router.push({ pathname: '/onboarding/first-look', params } as never);
    }
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

        <Text style={styles.title}>How much can you commit?</Text>
        <Text style={styles.subtitle}>Your plan should fit your life, not take it over.</Text>

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
            <ReanimatedAnimated.View key={selectedIndex} entering={FadeIn.duration(120)}>
              <Text style={styles.readoutLevel}>
                {selectedIndex! + 1} <Text style={styles.readoutLevelMuted}>/ 8</Text>
              </Text>
              <Text style={styles.readoutName}>{selected.name}</Text>
              {selected.quote ? <Text style={styles.readoutQuote}>{selected.quote}</Text> : null}
            </ReanimatedAnimated.View>
          ) : (
            <Text style={styles.readoutPrompt}>Turn the dial to set your commitment.</Text>
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
            <Text style={styles.primaryText}>Build my plan →</Text>
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
      top: 188,
      paddingLeft: 32,
      paddingRight: 36,
      color: colors.text,
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.4,
      textAlign: 'left',
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 224,
      paddingLeft: 32,
      paddingRight: 96,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16.5,
      textAlign: 'left',
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
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
      textAlign: 'center',
    },
    readoutQuote: {
      marginTop: 8,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 10.5,
      lineHeight: 15,
      fontFamily: 'Geist-Regular',
      textAlign: 'center',
    },
    readoutPrompt: {
      color: colors.textTertiary,
      fontSize: 11,
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
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
      zIndex: -1,
    },
  });
}
