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
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;
const CARD_RADIUS = 10;

export type TrainingDayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const TRAINING_DAYS: Array<{ id: TrainingDayId; label: string }> = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' },
];

/** One day row's hover/press feel — same primitives as every other Vervein button. */
function useOptionCardInteraction() {
  const hover = useHoverFade();
  const press = useLiquidPress();
  return { hover, press };
}

export default function OnboardingTrainingDaysScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience, environment, healthConsent, sex, heightCm, weightKg, duration, days: incomingDays } =
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
  };

  // Arriving here by going back from step-9 carries the prior selection
  // forward — seed from it instead of resetting to a blank form.
  const [selectedDays, setSelectedDays] = useState<TrainingDayId[]>(
    incomingDays ? (incomingDays.split(',').filter(Boolean) as TrainingDayId[]) : []
  );

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  // One hook instance per day — order is fixed (TRAINING_DAYS is a
  // module-level constant), so this satisfies the rules of hooks despite
  // being in a loop.
  const interactions = [
    useOptionCardInteraction(),
    useOptionCardInteraction(),
    useOptionCardInteraction(),
    useOptionCardInteraction(),
    useOptionCardInteraction(),
    useOptionCardInteraction(),
    useOptionCardInteraction(),
  ];

  const isSelectionEmpty = selectedDays.length === 0;

  const handleToggleDay = (day: TrainingDayId) => {
    hapticSelect();
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleContinue = () => {
    if (isSelectionEmpty) return;
    hapticImpactLight();
    // Days are stored as stable lowercase ids (not display labels) so a
    // future scheduling/notification system can consume them directly.
    const params = { ...baseParams, days: selectedDays.join(',') };
    saveOnboardingDraft({ step: 9, params });
    router.push({ pathname: '/onboarding/step-9', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <OnboardingProgress step={8} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-7', baseParams)}
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

        <Text style={styles.title}>Which days do you want to train?</Text>
        <Text style={styles.subtitle}>Pick the days that fit your week.</Text>

        <View style={styles.cardStack}>
          {TRAINING_DAYS.map((day, index) => {
            const { hover, press } = interactions[index];
            const isSelected = selectedDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                style={styles.card}
                onPress={() => handleToggleDay(day.id)}
                onHoverIn={hover.onHoverIn}
                onHoverOut={hover.onHoverOut}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
              >
                <Animated.View
                  style={[
                    styles.cardVisual,
                    isSelected && styles.cardVisualSelected,
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
                  <View pointerEvents="none" style={styles.cardSheen} />
                  <Text style={styles.optionTitle}>{day.label}</Text>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <View style={styles.checkDot} />
                    </View>
                  ) : null}
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          disabled={isSelectionEmpty}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isSelectionEmpty && styles.primaryButtonDisabled,
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
    // Title wraps to two lines at this width/weight — clear that, not a
    // single-line title.
    top: 258,
    paddingHorizontal: 60,
    color: '#b0b0b0',
    fontSize: 11,
    lineHeight: 16.5,
    textAlign: 'center',
    fontFamily: 'Geist-Medium',
  },
  cardStack: {
    position: 'absolute',
    left: 16,
    top: 300,
    width: 343,
  },
  card: {
    marginBottom: 10,
  },
  cardVisual: {
    width: '100%',
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0C0C0C',
  },
  // A static, subtle top-edge highlight — matches the same treatment on the
  // Goal/Experience/Equipment/Duration cards (selectable-cards.tsx).
  cardSheen: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    height: '48%',
    borderTopLeftRadius: CARD_RADIUS - 1,
    borderTopRightRadius: CARD_RADIUS - 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    zIndex: -1,
  },
  cardWash: {
    borderRadius: CARD_RADIUS,
    backgroundColor: '#ffffff',
    zIndex: -1,
  },
  cardVisualSelected: {
    borderColor: '#438C63',
  },
  cardWashSelected: {
    borderRadius: CARD_RADIUS,
    backgroundColor: '#438C63',
    opacity: 0.16,
    zIndex: -1,
  },
  optionTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12.5,
    fontFamily: 'Geist-SemiBold',
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,140,99,0.18)',
  },
  checkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#438C63',
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
