import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { goBack } from '@/lib/onboarding-nav';
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
type UnitSystem = 'imperial' | 'metric';

const SEX_OPTIONS: Array<{ id: SexId; label: string }> = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

const UNIT_OPTIONS: Array<{ id: UnitSystem; label: string }> = [
  { id: 'imperial', label: 'ft / lb' },
  { id: 'metric', label: 'cm / kg' },
];

// 3'0"–7'11" covers the practical range for an adult training app without
// making the wheel unwieldy to scroll through.
const FEET_ITEMS = Array.from({ length: 5 }, (_, i) => `${i + 3} ft`);
const INCHES_ITEMS = Array.from({ length: 12 }, (_, i) => `${i} in`);
// 80–360 lb — generous enough to not clip anyone, still a bounded wheel.
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);
// 120–220 cm / 35–180 kg — the metric equivalents of the same practical range.
const HEIGHT_CM_ITEMS = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35} kg`);

const DEFAULT_HEIGHT_CM = 170; // ~5'7", close to a population median
const DEFAULT_WEIGHT_KG = 73; // ~160 lb

function cmToFeetInches(cm: number): { feetIndex: number; inchesIndex: number } {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.min(7, Math.max(3, Math.floor(totalInches / 12)));
  const inches = Math.min(11, Math.max(0, totalInches - feet * 12));
  return { feetIndex: feet - 3, inchesIndex: inches };
}

function feetInchesToCm(feetIndex: number, inchesIndex: number): number {
  return Math.round((feetIndex + 3) * 30.48 + inchesIndex * 2.54);
}

function kgToLbIndex(kg: number): number {
  return Math.min(WEIGHT_LB_ITEMS.length - 1, Math.max(0, Math.round(kg / 0.453592) - 80));
}

function lbToKg(lbIndex: number): number {
  return Math.round((lbIndex + 80) * 0.453592);
}

function cmToCmIndex(cm: number): number {
  return Math.min(HEIGHT_CM_ITEMS.length - 1, Math.max(0, cm - 120));
}

function kgToKgIndex(kg: number): number {
  return Math.min(WEIGHT_KG_ITEMS.length - 1, Math.max(0, kg - 35));
}

export default function OnboardingBiometricsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience, environment, healthConsent, sex: incomingSex, heightCm, weightKg } =
    useLocalSearchParams<{
      name?: string;
      goal?: string;
      experience?: string;
      environment?: string;
      healthConsent?: string;
      sex?: string;
      heightCm?: string;
      weightKg?: string;
    }>();

  const baseParams = {
    name: name ?? '',
    goal: goal ?? '',
    experience: experience ?? '',
    environment: environment ?? '',
    healthConsent: healthConsent ?? 'false',
  };

  // Arriving here by going back from step-7 carries the prior answer
  // forward — seed from it instead of resetting to a blank form.
  const [sex, setSex] = useState<SexId | null>(incomingSex === 'female' || incomingSex === 'male' ? incomingSex : null);
  const [unit, setUnit] = useState<UnitSystem>('imperial');

  // Canonical values stay in metric regardless of which unit is displayed —
  // both wheel sets read/write these so switching units never loses data.
  const [heightCmValue, setHeightCmValue] = useState(Number(heightCm) || DEFAULT_HEIGHT_CM);
  const [weightKgValue, setWeightKgValue] = useState(Number(weightKg) || DEFAULT_WEIGHT_KG);

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const femaleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const maleInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const sexInteractions: Record<SexId, typeof femaleInteraction> = {
    female: femaleInteraction,
    male: maleInteraction,
  };

  const imperialUnitInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const metricUnitInteraction = { hover: useHoverFade(), press: useLiquidPress() };
  const unitInteractions: Record<UnitSystem, typeof imperialUnitInteraction> = {
    imperial: imperialUnitInteraction,
    metric: metricUnitInteraction,
  };

  const isUnselected = sex === null;

  const handleSelectSex = (id: SexId) => {
    hapticSelect();
    setSex(id);
  };

  const handleSelectUnit = (id: UnitSystem) => {
    if (id === unit) return;
    hapticSelect();
    setUnit(id);
  };

  const { feetIndex, inchesIndex } = cmToFeetInches(heightCmValue);
  const lbIndex = kgToLbIndex(weightKgValue);
  const cmIndex = cmToCmIndex(heightCmValue);
  const kgIndex = kgToKgIndex(weightKgValue);

  const handleContinue = () => {
    if (sex === null) return;
    hapticImpactLight();
    const params = {
      ...baseParams,
      sex,
      heightCm: String(heightCmValue),
      weightKg: String(weightKgValue),
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

        <OnboardingProgress step={6} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-5', baseParams)}
          hitSlop={12}
        >
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

        <View style={styles.unitRow}>
          {UNIT_OPTIONS.map((option) => {
            const { hover, press } = unitInteractions[option.id];
            const isSelected = unit === option.id;
            return (
              <Pressable
                key={option.id}
                style={styles.unitPillHit}
                onPress={() => handleSelectUnit(option.id)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
              >
                <Animated.View
                  style={[
                    styles.unitPillVisual,
                    isSelected && styles.unitPillVisualSelected,
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
                  <Text style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}>
                    {option.label}
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, styles.heightLabel]}>Height</Text>
        <Text style={[styles.fieldLabel, styles.weightLabel]}>Weight</Text>

        {unit === 'imperial' ? (
          <>
            <View style={styles.heightWheelRow}>
              <WheelPicker
                key="feet"
                items={FEET_ITEMS}
                selectedIndex={feetIndex}
                onChange={(index) => setHeightCmValue(feetInchesToCm(index, inchesIndex))}
                width={76}
              />
              <WheelPicker
                key="inches"
                items={INCHES_ITEMS}
                selectedIndex={inchesIndex}
                onChange={(index) => setHeightCmValue(feetInchesToCm(feetIndex, index))}
                width={76}
              />
            </View>
            <View style={styles.weightWheelWrap}>
              <WheelPicker
                key="lb"
                items={WEIGHT_LB_ITEMS}
                selectedIndex={lbIndex}
                onChange={(index) => setWeightKgValue(lbToKg(index))}
                width={110}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.heightWheelRow}>
              <WheelPicker
                key="cm"
                items={HEIGHT_CM_ITEMS}
                selectedIndex={cmIndex}
                onChange={(index) => setHeightCmValue(index + 120)}
                width={163}
              />
            </View>
            <View style={styles.weightWheelWrap}>
              <WheelPicker
                key="kg"
                items={WEIGHT_KG_ITEMS}
                selectedIndex={kgIndex}
                onChange={(index) => setWeightKgValue(index + 35)}
                width={110}
              />
            </View>
          </>
        )}

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
    textAlign: 'center',
    fontFamily: 'Geist-SemiBold',
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
    textAlign: 'center',
    fontFamily: 'Geist-Medium',
  },
  fieldLabel: {
    position: 'absolute',
    left: 16,
    top: 288,
    color: '#7a7a7a',
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: 'Geist-SemiBold',
  },
  heightLabel: {
    top: 384,
  },
  weightLabel: {
    top: 384,
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
    fontFamily: 'Geist-SemiBold',
  },
  // Small right-aligned segmented control — a secondary, low-emphasis choice
  // (unlike Sex, it has a sensible default and doesn't gate Continue), so it
  // reads as a compact toggle rather than another full-width question.
  //
  // Two fully independent pills (own border + background each), not one
  // fused strip split down the middle — a shared surface meant each pill's
  // own press-scale animation distorted the joined shape when pressed,
  // and there was no visible seam marking where one tap zone ended and the
  // next began. Same small-toggle concept, just structurally separate now,
  // matching how the Sex-at-birth pills already work.
  unitRow: {
    position: 'absolute',
    right: 16,
    top: 354,
    width: 148,
    flexDirection: 'row',
    gap: 6,
  },
  unitPillHit: {
    flex: 1,
    height: 22,
  },
  unitPillVisual: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    backgroundColor: '#0C0C0C',
  },
  unitPillVisualSelected: {
    borderColor: '#438C63',
    backgroundColor: 'rgba(67,140,99,0.18)',
  },
  unitPillText: {
    color: '#6e6e6e',
    fontSize: 10,
    fontFamily: 'Geist-SemiBold',
  },
  unitPillTextSelected: {
    color: '#438C63',
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
    top: 404,
    width: 163,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightWheelWrap: {
    position: 'absolute',
    left: 222,
    top: 404,
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
