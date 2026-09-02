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

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export type ExperienceLevelId = 'just-starting' | 'trained-before' | 'train-regularly' | 'years-experience';

const EXPERIENCE_LEVELS: SelectableCardOption<ExperienceLevelId>[] = [
  { id: 'just-starting', label: 'I’m just getting started', subtitle: 'I’m new to structured training' },
  { id: 'trained-before', label: 'I’ve trained before', subtitle: 'I know the basics, but I’m getting back into it' },
  { id: 'train-regularly', label: 'I train regularly', subtitle: 'I’m comfortable with structured workouts' },
  { id: 'years-experience', label: 'I’ve been training for years', subtitle: 'I’m experienced and know my way around the gym' },
];

export default function OnboardingExperienceScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { name, goal, verifiedEmail } = useLocalSearchParams<{ name?: string; goal?: string; verifiedEmail?: string }>();

  const entering = useFadeInEntering();

  const handleSelectExperience = (experience: ExperienceLevelId) => {
    const params = { name: name ?? '', goal: goal ?? '', verifiedEmail: verifiedEmail ?? '', experience };
    saveOnboardingDraft({ step: 4, params });
    router.push({ pathname: '/onboarding/step-4', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <OnboardingProgress step={3} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-2', { name: name ?? '' })}
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

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Where are you at with training?</Text>

        <View style={styles.cardStack}>
          <SingleSelectCards options={EXPERIENCE_LEVELS} onSelect={handleSelectExperience} />
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
      left: 0,
      right: 0,
      top: 188,
      paddingHorizontal: 52,
      color: colors.text,
      fontSize: 20,
      lineHeight: 27,
      textAlign: 'center',
      fontFamily: 'Geist-SemiBold',
    },
    cardStack: {
      position: 'absolute',
      left: 16,
      top: 330,
      width: 343,
    },
  });
}
