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
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export type WorkoutDurationId = 'under-30' | '30-45' | '45-60' | '60-plus';
export type TrainingDayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DURATIONS: { id: WorkoutDurationId; label: string }[] = [
  { id: 'under-30', label: '< 30m' },
  { id: '30-45', label: '30–45m' },
  { id: '45-60', label: '45–60m' },
  { id: '60-plus', label: '60m+' },
];

const DAYS: { id: TrainingDayId; label: string }[] = [
  { id: 'monday', label: 'Mo' },
  { id: 'tuesday', label: 'Tu' },
  { id: 'wednesday', label: 'We' },
  { id: 'thursday', label: 'Th' },
  { id: 'friday', label: 'Fr' },
  { id: 'saturday', label: 'Sa' },
  { id: 'sunday', label: 'Su' },
];

/** One option's hover/press feel — same primitives as every other Vervein control. */
function useOptionInteraction() {
  const hover = useHoverFade();
  const press = useLiquidPress();
  return { hover, press };
}

/**
 * Duration and Days merged into one screen — previously two full stops for
 * two halves of the same "how much, how often" question. Both are now
 * compact single-row pickers (a segmented duration row, a week-view of day
 * circles) instead of two separate full-width card stacks, which is also
 * what makes the merge fit on one screen at all.
 */
export default function OnboardingScheduleScreen() {
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
    healthConsent,
    sex,
    heightCm,
    weightKg,
    duration: incomingDuration,
    days: incomingDays,
  } = useLocalSearchParams<{
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
  };

  const [duration, setDuration] = useState<WorkoutDurationId | null>(
    (incomingDuration as WorkoutDurationId) || null
  );
  const [selectedDays, setSelectedDays] = useState<TrainingDayId[]>(
    incomingDays ? (incomingDays.split(',').filter(Boolean) as TrainingDayId[]) : []
  );

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const durationInteractions = [
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
  ];
  const dayInteractions = [
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
    useOptionInteraction(),
  ];

  const isUnselected = duration === null || selectedDays.length === 0;

  const handleSelectDuration = (id: WorkoutDurationId) => {
    hapticSelect();
    setDuration(id);
  };

  const handleToggleDay = (day: TrainingDayId) => {
    hapticSelect();
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleContinue = () => {
    if (isUnselected) return;
    hapticImpactLight();
    const params = { ...baseParams, duration: duration as WorkoutDurationId, days: selectedDays.join(',') };
    saveOnboardingDraft({ step: 7, params });
    router.push({ pathname: '/onboarding/step-7', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <OnboardingProgress step={6} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-5', baseParams)}
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

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>How much time, how often?</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Set your typical session length and training days.</Text>

        <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Session length</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((option, index) => {
            const { hover, press } = durationInteractions[index];
            const isSelected = duration === option.id;
            return (
              <Pressable
                key={option.id}
                style={styles.durationPillHit}
                onPress={() => handleSelectDuration(option.id)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
              >
                <Animated.View
                  style={[
                    styles.durationPillVisual,
                    isSelected && styles.pillVisualSelected,
                    { transform: [{ scale: press.scale }] },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.pillWash,
                      { opacity: hover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.pillWash,
                      { opacity: press.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) },
                    ]}
                  />
                  <Text
                    style={[styles.durationPillText, isSelected && styles.pillTextSelected]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {option.label}
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, styles.daysLabel]} maxFontSizeMultiplier={1.3}>Training days</Text>
        <View style={styles.daysRow}>
          {DAYS.map((day, index) => {
            const { hover, press } = dayInteractions[index];
            const isSelected = selectedDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                style={styles.dayCircleHit}
                onPress={() => handleToggleDay(day.id)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
              >
                <Animated.View
                  style={[
                    styles.dayCircleVisual,
                    isSelected && styles.pillVisualSelected,
                    { transform: [{ scale: press.scale }] },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.dayCircleWash,
                      { opacity: hover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }) },
                    ]}
                  />
                  <Text
                    style={[styles.dayCircleText, isSelected && styles.pillTextSelected]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {day.label}
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
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
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

const CARD_RADIUS = 10;

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
      top: 188,
      paddingHorizontal: 40,
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
      top: 222,
      paddingHorizontal: 56,
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16.5,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    fieldLabel: {
      position: 'absolute',
      left: 16,
      top: 284,
      color: colors.textTertiary,
      fontSize: 10.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      fontFamily: 'Geist-SemiBold',
    },
    daysLabel: {
      top: 372,
    },
    durationRow: {
      position: 'absolute',
      left: 16,
      top: 306,
      width: 343,
      flexDirection: 'row',
      gap: 8,
    },
    durationPillHit: {
      flex: 1,
      height: 46,
    },
    durationPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    durationPillText: {
      color: colors.text,
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
    },
    daysRow: {
      position: 'absolute',
      left: 16,
      top: 394,
      width: 343,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayCircleHit: {
      width: 42,
      height: 42,
    },
    dayCircleVisual: {
      width: '100%',
      height: '100%',
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    dayCircleWash: {
      borderRadius: 21,
      backgroundColor: washColor,
      zIndex: -1,
    },
    dayCircleText: {
      color: colors.text,
      fontSize: 11.5,
      fontFamily: 'Geist-SemiBold',
    },
    pillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    pillTextSelected: {
      color: '#438C63',
    },
    pillWash: {
      borderRadius: CARD_RADIUS,
      backgroundColor: washColor,
      zIndex: -1,
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
      backgroundColor: washColor,
      zIndex: -1,
    },
  });
}
