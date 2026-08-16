import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

type SexId = 'female' | 'male';

const SEX_OPTIONS: Array<{ id: SexId; label: string }> = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

// 3'0"–7'11" covers the practical range for an adult training app without
// making the wheel unwieldy to scroll through.
const FEET_ITEMS = Array.from({ length: 5 }, (_, i) => `${i + 3} ft`);
const INCHES_ITEMS = Array.from({ length: 12 }, (_, i) => `${i} in`);
// 80–360 lb — generous enough to not clip anyone, still a bounded wheel.
const WEIGHT_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);

const DEFAULT_FEET_INDEX = 2; // 5 ft
const DEFAULT_INCHES_INDEX = 7; // 7 in — 5'7", close to a population median
const DEFAULT_WEIGHT_INDEX = 80; // 160 lb

export default function OnboardingBiometricsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience, environment, duration, days } = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    duration?: string;
    days?: string;
  }>();

  const [sex, setSex] = useState<SexId | null>(null);
  const [feetIndex, setFeetIndex] = useState(DEFAULT_FEET_INDEX);
  const [inchesIndex, setInchesIndex] = useState(DEFAULT_INCHES_INDEX);
  const [weightIndex, setWeightIndex] = useState(DEFAULT_WEIGHT_INDEX);

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const femaleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const maleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const sexInteractions: Record<SexId, typeof femaleInteraction> = {
    female: femaleInteraction,
    male: maleInteraction,
  };

  const isUnselected = sex === null;

  const handleSelectSex = (id: SexId) => {
    hapticSelect();
    setSex(id);
  };

  const handleContinue = () => {
    if (sex === null) return;
    hapticImpactLight();
    const heightCm = Math.round((feetIndex + 3) * 30.48 + inchesIndex * 2.54);
    const weightKg = Math.round((weightIndex + 80) * 0.453592);
    const params = {
      name: name ?? '',
      goal: goal ?? '',
      experience: experience ?? '',
      environment: environment ?? '',
      duration: duration ?? '',
      days: days ?? '',
      sex,
      heightCm: String(heightCm),
      weightKg: String(weightKg),
    };
    saveOnboardingDraft({ step: 8, params });
    router.push({ pathname: '/onboarding/step-8', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <OnboardingProgress step={7} />

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

        <Text style={styles.title}>A few quick numbers</Text>
        <Text style={styles.subtitle}>This helps us tailor your training load.</Text>

        <Text style={styles.fieldLabel}>Sex at birth</Text>
        <View style={styles.sexRow}>
          {SEX_OPTIONS.map((option) => {
            const { hover, press } = sexInteractions[option.id];
            const isSelected = sex === option.id;
            return (
              <Pressable
                key={option.id}
                style={styles.sexPillHit}
                onPress={() => handleSelectSex(option.id)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
              >
                <Animated.View
                  style={[
                    styles.sexPillVisual,
                    isSelected && styles.sexPillVisualSelected,
                    { transform: [{ scale: press.scale }] },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.cardWash,
                      { opacity: hover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.cardWash,
                      { opacity: press.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) },
                    ]}
                  />
                  {isSelected ? (
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardWashSelected]} />
                  ) : null}
                  <Text style={styles.sexPillText}>{option.label}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, styles.heightLabel]}>Height</Text>
        <Text style={[styles.fieldLabel, styles.weightLabel]}>Weight</Text>

        <View style={styles.heightWheelRow}>
          <WheelPicker items={FEET_ITEMS} selectedIndex={feetIndex} onChange={setFeetIndex} width={76} />
          <WheelPicker items={INCHES_ITEMS} selectedIndex={inchesIndex} onChange={setInchesIndex} width={76} />
        </View>

        <View style={styles.weightWheelWrap}>
          <WheelPicker items={WEIGHT_ITEMS} selectedIndex={weightIndex} onChange={setWeightIndex} width={110} />
        </View>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
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
            <Text style={styles.primaryText}>Continue</Text>
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
    paddingHorizontal: 44,
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
    top: 226,
    paddingHorizontal: 60,
    color: '#b0b0b0',
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'System',
  },
  fieldLabel: {
    position: 'absolute',
    left: 16,
    top: 288,
    color: '#7a7a7a',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: 'System',
  },
  heightLabel: {
    top: 368,
  },
  weightLabel: {
    top: 368,
    left: 196,
  },
  sexRow: {
    position: 'absolute',
    left: 16,
    top: 308,
    width: 343,
    flexDirection: 'row',
    gap: 11,
  },
  sexPillHit: {
    flex: 1,
    height: 38,
  },
  sexPillVisual: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6.69,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    backgroundColor: '#0C0C0C',
  },
  sexPillVisualSelected: {
    borderColor: '#438C63',
  },
  sexPillText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'System',
  },
  cardWash: {
    borderRadius: 6.69,
    backgroundColor: '#ffffff',
    zIndex: -1,
  },
  cardWashSelected: {
    borderRadius: 6.69,
    backgroundColor: '#438C63',
    opacity: 0.22,
    zIndex: -1,
  },
  heightWheelRow: {
    position: 'absolute',
    left: 16,
    top: 388,
    width: 163,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightWheelWrap: {
    position: 'absolute',
    left: 222,
    top: 388,
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
  hoverWash: {
    borderRadius: 6,
    backgroundColor: '#ffffff',
    zIndex: -1,
  },
});
