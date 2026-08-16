import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useFadeInEntering } from '@/lib/screen-transitions';
import { GlowGraphic, LogoMarkAccentGraphic, LogoMarkGraphic } from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { SelectableCardOption, SingleSelectCards } from '@/components/onboarding/selectable-cards';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export type WorkoutDurationId = 'under-30' | '30-45' | '45-60' | '60-plus';

const WORKOUT_DURATIONS: SelectableCardOption<WorkoutDurationId>[] = [
  { id: 'under-30', label: 'Under 30 minutes', subtitle: 'I need workouts that fit into a busy schedule' },
  { id: '30-45', label: '30–45 minutes', subtitle: 'I have enough time for a focused workout' },
  { id: '45-60', label: '45–60 minutes', subtitle: 'I can dedicate a solid hour to training' },
  { id: '60-plus', label: '60+ minutes', subtitle: 'I have plenty of time to train' },
];

export default function OnboardingDurationScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience, environment, sex, heightCm, weightKg } = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
  }>();

  const entering = useFadeInEntering();

  const handleSelectDuration = (duration: WorkoutDurationId) => {
    const params = {
      name: name ?? '',
      goal: goal ?? '',
      experience: experience ?? '',
      environment: environment ?? '',
      sex: sex ?? '',
      heightCm: heightCm ?? '',
      weightKg: weightKg ?? '',
      duration,
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

        <Text style={styles.title}>How much time can you give each workout?</Text>

        <View style={styles.cardStack}>
          <SingleSelectCards options={WORKOUT_DURATIONS} onSelect={handleSelectDuration} />
        </View>
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
  cardStack: {
    position: 'absolute',
    left: 16,
    top: 330,
    width: 343,
  },
});
