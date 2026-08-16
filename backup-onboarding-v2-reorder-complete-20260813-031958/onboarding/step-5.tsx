import { router, useLocalSearchParams } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';
import { useState } from 'react';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

// PLACEHOLDER COPY — legal review required before ship. This screen exists
// to be the real opt-in gate (not just reassuring copy) ahead of collecting
// any body-related data, per Washington's My Health My Data Act and
// equivalent health-data consent requirements. The checkbox below is a
// functioning gate (Continue stays disabled until checked) — only the
// wording is a stand-in.
const CONSENT_COPY =
  'I agree to share my height, weight, and sex at birth so Vervein can tailor my training load. This information is never sold and is used only to personalize my plan.';

export default function OnboardingHealthConsentScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience, environment } = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
  }>();

  const [consented, setConsented] = useState(false);

  const entering = useFadeInEntering();
  const checkboxHover = useHoverFade();
  const checkboxPress = useLiquidPress();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();
  const skipHover = useHoverFade();
  const skipPress = useLiquidPress();

  const baseParams = {
    name: name ?? '',
    goal: goal ?? '',
    experience: experience ?? '',
    environment: environment ?? '',
  };

  const handleToggleConsent = () => {
    hapticSelect();
    setConsented((prev) => !prev);
  };

  const handleContinue = () => {
    if (!consented) return;
    hapticImpactLight();
    const params = { ...baseParams, healthConsent: 'true' };
    saveOnboardingDraft({ step: 6, params });
    router.push({ pathname: '/onboarding/step-6', params } as never);
  };

  // Declining consent skips Biometrics entirely — collecting height/weight/sex
  // without the opt-in isn't an option, so Skip jumps straight past it rather
  // than routing through a screen it can no longer answer.
  const handleSkip = () => {
    hapticImpactLight();
    const params = {
      ...baseParams,
      healthConsent: 'false',
      sex: '',
      heightCm: '',
      weightKg: '',
    };
    saveOnboardingDraft({ step: 7, params });
    router.push({ pathname: '/onboarding/step-7', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <OnboardingProgress step={5} />

        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <BackArrowGraphic />
        </Pressable>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={45.32} height={52.31} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={33.99} height={44.75} />
          </View>
        </View>

        <Text style={styles.title}>A couple of questions about your body</Text>
        <Text style={styles.subtitle}>
          Not to diagnose anything — just so your plan starts in the right place. Everything from here is optional.
        </Text>

        <Pressable
          style={styles.consentRow}
          onPress={handleToggleConsent}
          onHoverIn={checkboxHover.onHoverIn}
          onHoverOut={checkboxHover.onHoverOut}
          onPressIn={checkboxPress.onPressIn}
          onPressOut={checkboxPress.onPressOut}
        >
          <Animated.View style={[styles.consentCard, { transform: [{ scale: checkboxPress.scale }] }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.cardWash,
                { opacity: checkboxHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }) },
              ]}
            />
            <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
              {consented ? <View style={styles.checkboxDot} /> : null}
            </View>
            <Text style={styles.consentText}>{CONSENT_COPY}</Text>
          </Animated.View>
        </Pressable>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          disabled={!consented}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              !consented && styles.primaryButtonDisabled,
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
            <Text style={styles.primaryText}>Continue</Text>
            <View style={styles.buttonArrow}>
              <ArrowUpIconGraphic size={24} />
            </View>
          </Animated.View>
        </Pressable>

        <Pressable
          style={styles.skipButtonHit}
          onPress={handleSkip}
          onHoverIn={skipHover.onHoverIn}
          onHoverOut={skipHover.onHoverOut}
          onPressIn={skipPress.onPressIn}
          onPressOut={skipPress.onPressOut}
        >
          <Animated.View style={[styles.skipButtonVisual, { transform: [{ scale: skipPress.scale }] }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: skipHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
              ]}
            />
            <Text style={styles.skipText}>Skip this section</Text>
          </Animated.View>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  fadeLayer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  glow: {
    position: 'absolute',
    left: -83,
    top: -100,
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
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'System',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 248,
    paddingHorizontal: 48,
    color: '#b0b0b0',
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'System',
  },
  consentRow: {
    position: 'absolute',
    left: 16,
    top: 340,
    width: 343,
  },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 6.69,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    backgroundColor: '#0C0C0C',
  },
  cardWash: {
    borderRadius: 6.69,
    backgroundColor: '#ffffff',
    zIndex: -1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#676767',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: '#438C63',
    backgroundColor: 'rgba(67,140,99,0.16)',
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 2.5,
    backgroundColor: '#438C63',
  },
  consentText: {
    flex: 1,
    color: '#d0d0d0',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    fontFamily: 'System',
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
    fontWeight: '500',
    fontFamily: 'System',
  },
  buttonArrow: {
    position: 'absolute',
    right: 14,
    top: 6,
    transform: [{ rotate: '90deg' }],
  },
  // Same size/weight as the primary Continue button — a real equal-weight
  // choice, not a buried grey link, per the "optional, skippable" contract
  // every health-adjacent screen in this flow follows.
  skipButtonHit: {
    position: 'absolute',
    left: 46,
    top: 704,
    width: 285,
    height: 38,
  },
  skipButtonVisual: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#b0b0b0',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  hoverWash: {
    borderRadius: 6,
    backgroundColor: '#ffffff',
    zIndex: -1,
  },
});
