import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppTheme } from '@/lib/theme-context';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

// PLACEHOLDER COPY — legal review required before ship. Real opt-in gate
// (not just reassuring copy) ahead of collecting any body-related data, per
// Washington's My Health My Data Act and equivalent health-data consent
// requirements. The checkbox below is a functioning gate — the fields
// beneath it stay inert until it's checked — only the wording is a stand-in.
const CONSENT_COPY = 'I agree to share this to tailor my training load.';

type SexId = 'female' | 'male';
type UnitSystem = 'imperial' | 'metric';

const SEX_OPTIONS: { id: SexId; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

const UNIT_OPTIONS: { id: UnitSystem; label: string }[] = [
  { id: 'imperial', label: 'ft / lb' },
  { id: 'metric', label: 'cm / kg' },
];

const FEET_ITEMS = Array.from({ length: 5 }, (_, i) => `${i + 3} ft`);
const INCHES_ITEMS = Array.from({ length: 12 }, (_, i) => `${i} in`);
const WEIGHT_LB_ITEMS = Array.from({ length: 281 }, (_, i) => `${i + 80} lb`);
const HEIGHT_CM_ITEMS = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const WEIGHT_KG_ITEMS = Array.from({ length: 146 }, (_, i) => `${i + 35} kg`);

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 73;

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

/**
 * Consent and Biometrics merged into one screen — previously two full
 * stops (a screen that only explained why the next screen would ask for
 * body data, then the screen that actually asked). The gate is now inline:
 * height/weight/sex fields sit right below the checkbox and stay visually
 * inert (dimmed, non-interactive) until it's checked, rather than being a
 * separate screen you couldn't reach without it.
 */
export default function OnboardingConsentBiometricsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const washColor = resolvedScheme === 'dark' ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, washColor), [colors, washColor]);

  const {
    name,
    goal,
    experience,
    environment,
    healthConsent: incomingConsent,
    sex: incomingSex,
    heightCm,
    weightKg,
  } = useLocalSearchParams<{
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
  };

  // Arriving here by going back carries prior answers forward instead of
  // resetting the form.
  const [consented, setConsented] = useState(incomingConsent === 'true');
  const [sex, setSex] = useState<SexId | null>(incomingSex === 'female' || incomingSex === 'male' ? incomingSex : null);
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [heightCmValue, setHeightCmValue] = useState(Number(heightCm) || DEFAULT_HEIGHT_CM);
  const [weightKgValue, setWeightKgValue] = useState(Number(weightKg) || DEFAULT_WEIGHT_KG);

  const entering = useFadeInEntering();
  const checkboxHover = useHoverFade();
  const checkboxPress = useLiquidPress();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();
  const skipHover = useHoverFade();
  const skipPress = useLiquidPress();

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

  const isUnselected = !consented || sex === null;

  const handleToggleConsent = () => {
    hapticSelect();
    setConsented((prev) => !prev);
  };

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
    if (isUnselected) return;
    hapticImpactLight();
    const params = {
      ...baseParams,
      healthConsent: 'true',
      sex: sex as SexId,
      heightCm: String(heightCmValue),
      weightKg: String(weightKgValue),
    };
    saveOnboardingDraft({ step: 6, params });
    router.push({ pathname: '/onboarding/step-6', params } as never);
  };

  const handleSkip = () => {
    hapticImpactLight();
    const params = {
      ...baseParams,
      healthConsent: 'false',
      sex: '',
      heightCm: '',
      weightKg: '',
    };
    saveOnboardingDraft({ step: 6, params });
    router.push({ pathname: '/onboarding/step-6', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <OnboardingProgress step={5} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-4', baseParams)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
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

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>A few quick numbers</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Optional — used only to tailor your training load.</Text>

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
            <Text style={styles.consentText} maxFontSizeMultiplier={1.3}>{CONSENT_COPY}</Text>
          </Animated.View>
        </Pressable>

        <View style={[styles.fieldsBlock, { opacity: consented ? 1 : 0.35 }]} pointerEvents={consented ? 'auto' : 'none'}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Sex at birth</Text>
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
                    <Text style={styles.sexPillText} maxFontSizeMultiplier={1.2}>{option.label}</Text>
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
                    <Text
                      style={[styles.unitPillText, isSelected && styles.unitPillTextSelected]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {option.label}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, styles.heightLabel]} maxFontSizeMultiplier={1.3}>Height</Text>
          <Text style={[styles.fieldLabel, styles.weightLabel]} maxFontSizeMultiplier={1.3}>Weight</Text>

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
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Continue</Text>
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
            <Text style={styles.skipText} maxFontSizeMultiplier={1.15}>Skip this section</Text>
          </Animated.View>
        </Pressable>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], washColor: string) {
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
      top: 168,
      paddingHorizontal: 44,
      color: colors.text,
      fontSize: 20,
      lineHeight: 27,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    subtitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 202,
      paddingHorizontal: 60,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16.5,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    consentRow: {
      position: 'absolute',
      left: 16,
      top: 232,
      width: 343,
    },
    consentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 6.69,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#BDBDBD',
      backgroundColor: colors.surface,
    },
    cardWash: {
      borderRadius: 6.69,
      backgroundColor: washColor,
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
      color: colors.text,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Geist-Regular',
    },
    fieldsBlock: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
    },
    fieldLabel: {
      position: 'absolute',
      left: 16,
      top: 300,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      fontFamily: 'Geist-SemiBold',
    },
    heightLabel: {
      top: 396,
    },
    weightLabel: {
      top: 396,
      left: 196,
    },
    sexRow: {
      position: 'absolute',
      left: 16,
      top: 320,
      width: 343,
      flexDirection: 'row',
      gap: 11,
    },
    sexPillHit: {
      flex: 1,
      height: 36,
    },
    sexPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6.69,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#BDBDBD',
      backgroundColor: colors.surface,
    },
    sexPillVisualSelected: {
      borderColor: '#438C63',
    },
    sexPillText: {
      color: colors.text,
      fontSize: 12.5,
      fontFamily: 'Geist-SemiBold',
    },
    unitRow: {
      position: 'absolute',
      left: 113.5,
      top: 364,
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
      borderColor: colors.pillBorder,
      backgroundColor: colors.surface,
    },
    unitPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    unitPillText: {
      color: colors.textSecondary,
      fontSize: 10,
      fontFamily: 'Geist-SemiBold',
    },
    unitPillTextSelected: {
      color: '#438C63',
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
      top: 416,
      width: 163,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    weightWheelWrap: {
      position: 'absolute',
      left: 222,
      top: 416,
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
      borderColor: colors.surfaceBorder,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: washColor,
      zIndex: -1,
    },
  });
}
