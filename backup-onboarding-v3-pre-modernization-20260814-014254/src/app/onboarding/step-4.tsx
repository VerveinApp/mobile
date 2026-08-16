import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { GlowGraphic, LogoMarkAccentGraphic, LogoMarkGraphic } from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { SelectableCardOption, SingleSelectCards } from '@/components/onboarding/selectable-cards';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export type TrainingEnvironmentId = 'full-gym' | 'home-gym' | 'minimal-equipment' | 'bodyweight-only';

const TRAINING_ENVIRONMENTS: SelectableCardOption<TrainingEnvironmentId>[] = [
  { id: 'full-gym', label: 'Full gym', subtitle: 'Machines, free weights, and plenty of equipment' },
  { id: 'home-gym', label: 'Home gym', subtitle: 'I have my own equipment at home' },
  { id: 'minimal-equipment', label: 'Minimal equipment', subtitle: 'I have a few weights or basic equipment' },
  { id: 'bodyweight-only', label: 'Bodyweight only', subtitle: 'I primarily train without equipment' },
];

export default function OnboardingEnvironmentScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const { name, goal, experience } = useLocalSearchParams<{ name?: string; goal?: string; experience?: string }>();

  const entering = useFadeInEntering();

  const handleSelectEnvironment = (environment: TrainingEnvironmentId) => {
    const params = { name: name ?? '', goal: goal ?? '', experience: experience ?? '', environment };
    saveOnboardingDraft({ step: 5, params });
    // step-5 is the health-data consent gate ahead of Biometrics, not Duration.
    router.push({ pathname: '/onboarding/step-5', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <OnboardingProgress step={4} />

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-3', { name: name ?? '', goal: goal ?? '' })}
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

        <Text style={styles.title}>Where do you usually train?</Text>

        <View style={styles.cardStack}>
          <SingleSelectCards options={TRAINING_ENVIRONMENTS} onSelect={handleSelectEnvironment} />
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
    paddingHorizontal: 52,
    color: '#ffffff',
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
