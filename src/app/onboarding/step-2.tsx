import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors } from '@/lib/theme-context';
import { LogoMarkAccentGraphic, LogoMarkGraphic } from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { SelectableCardOption, SingleSelectCards } from '@/components/onboarding/selectable-cards';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';
import {
  BicepsIconGraphic,
  CardiologyIconGraphic,
  DumbbellIconGraphic,
  ScaleIconGraphic,
} from '@/components/auth/onboarding-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

type GoalId = 'build-physique' | 'get-leaner' | 'get-stronger' | 'move-better';

const GOALS: SelectableCardOption<GoalId>[] = [
  { id: 'build-physique', label: 'Build a physique you’re proud to show off', Icon: BicepsIconGraphic, iconSize: 27.09, width: 352 },
  { id: 'get-leaner', label: 'Get leaner without burning yourself out', Icon: ScaleIconGraphic, iconSize: 26.74, width: 343 },
  { id: 'get-stronger', label: 'Get stronger and keep progressing', Icon: DumbbellIconGraphic, iconSize: 37.82, width: 343 },
  { id: 'move-better', label: 'Move better, have more energy, and feel capable', Icon: CardiologyIconGraphic, iconSize: 26.74, width: 343 },
];

export default function OnboardingGoalScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { name, verifiedEmail } = useLocalSearchParams<{ name?: string; verifiedEmail?: string }>();
  const displayName = name || 'there';

  const entering = useFadeInEntering();

  const handleSelectGoal = (goal: GoalId) => {
    const params = { name: name ?? '', verifiedEmail: verifiedEmail ?? '', goal };
    saveOnboardingDraft({ step: 3, params });
    router.push({ pathname: '/onboarding/step-3', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <OnboardingProgress step={2} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding', { name: name ?? '' })}
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

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {'Well '}
          <Text style={styles.titleAccent}>{displayName}</Text>
          {", what's your primary goal?"}
        </Text>

        <View style={styles.cardStack}>
          <SingleSelectCards options={GOALS} onSelect={handleSelectGoal} cardSpacing={32} />
        </View>
      </ReanimatedAnimated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
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
      left: 100,
      top: 181,
      width: 176,
      color: colors.text,
      fontSize: 18,
      lineHeight: 27,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    titleAccent: {
      color: '#438C63',
      fontSize: 20,
    },
    cardStack: {
      position: 'absolute',
      left: 16,
      top: 342,
      width: 352,
    },
  });
}
