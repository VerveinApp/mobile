import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCanvasScale } from '@/lib/canvas-scale';
import ReanimatedAnimated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useSharedValue,
  withTiming,
  type LayoutAnimation,
} from 'react-native-reanimated';

import { useEnabledFadeStyle, useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/motion';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { AndroidRippleOnAccent, TabularNums, Type } from '@/constants/theme';
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

// The readout's number rolls like an odometer as the dial crosses each stop:
// the old digit slides out one way as the new one slides in from the other,
// clipped to the digit's own line so neither travels past it. Short, so a
// fast drag doesn't stack up ghosts.
const ROLL_DISTANCE = 25;
const ROLL_TIMING = {
  duration: MOTION_DURATION.base,
  easing: MOTION_EASING.standard,
  reduceMotion: ReduceMotion.System,
} as const;

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
  const initialIndex =
    seededIndex !== null && seededIndex >= 0 && seededIndex < COMMITMENT_LEVELS.length ? seededIndex : null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex);

  // Which way the dial last moved (1 up, -1 down), read by the digit's roll
  // at the moment it starts. A shared value rather than state because the
  // outgoing digit's exit props are frozen from its last render — only
  // something read when the exit begins knows which way the *new* change
  // went, so a reversal mid-drag doesn't roll the old digit the wrong way.
  const rollDir = useSharedValue(1);
  const lastDialIndex = useRef(initialIndex ?? -1);
  // Only touches a ref, a shared value and a setter, so it stays one stable
  // function — CommitmentDial rebuilds its pan gesture whenever onChange
  // changes, which would otherwise happen on every stop mid-drag.
  const handleDialChange = (index: number) => {
    rollDir.set(index >= lastDialIndex.current ? 1 : -1);
    lastDialIndex.current = index;
    setSelectedIndex(index);
  };
  const rollIn = (): LayoutAnimation => {
    'worklet';
    const dir = rollDir.get();
    return {
      initialValues: { opacity: 0, transform: [{ translateY: ROLL_DISTANCE * dir }] },
      animations: {
        opacity: withTiming(1, ROLL_TIMING),
        transform: [{ translateY: withTiming(0, ROLL_TIMING) }],
      },
    };
  };
  const rollOut = (): LayoutAnimation => {
    'worklet';
    const dir = rollDir.get();
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: {
        opacity: withTiming(0, ROLL_TIMING),
        transform: [{ translateY: withTiming(-ROLL_DISTANCE * dir, ROLL_TIMING) }],
      },
    };
  };

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const isUnselected = selectedIndex === null;
  const selected = selectedIndex !== null ? COMMITMENT_LEVELS[selectedIndex] : null;
  const continueEnabledFade = useEnabledFadeStyle(!isUnselected);

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
            onChange={handleDialChange}
            levelLabel={selected?.name}
          />
        </View>

        {/* BUG FIX: the whole readout used to be one keyed block with an
            entering fade and no exit, so every stop crossed mid-drag blanked
            it for a frame and faded it back up from nothing — a fast drag
            kept the screen's main number half-transparent and flashing. Now
            only the digit rolls (tabular, so '/ 8' holds still) and the name
            and quote cross-fade underneath it. */}
        <View style={styles.readout}>
          {selected ? (
            <>
              <View style={styles.readoutLevelRow} accessible accessibilityLabel={`${selectedIndex! + 1} of 8`}>
                <View style={styles.readoutDigitClip}>
                  <ReanimatedAnimated.Text
                    key={selectedIndex}
                    entering={rollIn}
                    exiting={rollOut}
                    style={styles.readoutLevel}
                    maxFontSizeMultiplier={1.1}
                  >
                    {selectedIndex! + 1}
                  </ReanimatedAnimated.Text>
                </View>
                <Text style={styles.readoutLevelMuted} maxFontSizeMultiplier={1.1}>/ 8</Text>
              </View>
              <ReanimatedAnimated.View
                key={selectedIndex}
                entering={FadeIn.duration(MOTION_DURATION.fast)}
                exiting={FadeOut.duration(100)}
                style={styles.readoutDetail}
              >
                <Text style={styles.readoutName} maxFontSizeMultiplier={1.3}>{selected.name}</Text>
                {selected.quote ? <Text style={styles.readoutQuote} maxFontSizeMultiplier={1.4}>{selected.quote}</Text> : null}
              </ReanimatedAnimated.View>
            </>
          ) : (
            <ReanimatedAnimated.Text
              exiting={FadeOut.duration(MOTION_DURATION.fast)}
              style={styles.readoutPrompt}
              maxFontSizeMultiplier={1.3}
            >
              Turn the dial to set your commitment.
            </ReanimatedAnimated.Text>
          )}
        </View>

        <Pressable
          style={styles.primaryButtonHit}
          // 38pt tall by design; the slop brings the tap target past 44pt.
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={handleBuildPlan}
          disabled={isUnselected}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
          android_ripple={AndroidRippleOnAccent}
        >
          <ReanimatedAnimated.View style={[styles.primaryButtonVisual, continueEnabledFade]}>
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
          </ReanimatedAnimated.View>
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
    readoutLevelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    // Sized by the incoming digit (the outgoing one has left layout), and
    // clips both as they roll so neither slides over the dial or the name.
    readoutDigitClip: {
      overflow: 'hidden',
    },
    readoutLevel: {
      color: colors.text,
      fontSize: 40,
      letterSpacing: -0.8,
      fontFamily: 'Geist-Black',
      textAlign: 'center',
      ...TabularNums,
    },
    // Its own Text now, not nested in the digit's, so it names its own face
    // instead of inheriting Geist-Black; the margin stands in for the 40pt
    // space that used to separate them.
    readoutLevelMuted: {
      marginLeft: 8,
      color: colors.textTertiary,
      fontSize: 15,
      letterSpacing: -0.8,
      fontFamily: 'Geist-Medium',
    },
    // Full width so the outgoing and incoming name/quote sit in the same
    // frame while they cross-fade.
    readoutDetail: {
      alignSelf: 'stretch',
      alignItems: 'center',
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
