import { router, useLocalSearchParams } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { computePlanPreview } from '@/lib/plan-preview';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * The payoff screen the entire flow is built around reaching — differentiation
 * demonstrated, not described. No progress bar: the question-answering part
 * of onboarding is done, this is the "here's why it was worth it" moment.
 */
export default function OnboardingFirstLookScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const params = useLocalSearchParams<{
    name?: string;
    goal?: string;
    experience?: string;
    environment?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
    duration?: string;
    days?: string;
    commitmentLevel?: string;
  }>();

  const entering = useFadeInEntering();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const lowEnergy = computePlanPreview(params, 2);
  const goodEnergy = computePlanPreview(params, 4);

  const handleCreateAccount = () => {
    hapticImpactLight();
    saveOnboardingDraft({ step: 11, params });
    router.push({ pathname: '/onboarding/create-account', params } as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/step-9', params)}
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

        <Text style={styles.title}>Here's the part that's different</Text>
        <Text style={styles.subtitle}>Same plan, two different days:</Text>

        <ReanimatedAnimated.View
          entering={FadeInDown.duration(400).delay(150).springify().damping(16)}
          style={styles.card}
        >
          <View pointerEvents="none" style={styles.cardSheen} />
          <Text style={styles.cardLabel}>Low energy day</Text>
          <Text style={styles.cardStat}>
            {lowEnergy.exerciseCount} <Text style={styles.cardStatUnit}>exercises</Text> · {lowEnergy.durationMin}{' '}
            <Text style={styles.cardStatUnit}>min</Text>
          </Text>
          <Text style={styles.cardExplanation}>{lowEnergy.explanation}</Text>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.View
          entering={FadeInDown.duration(400).delay(380).springify().damping(16)}
          style={[styles.card, styles.cardSecond]}
        >
          <View pointerEvents="none" style={styles.cardSheen} />
          <Text style={[styles.cardLabel, styles.cardLabelAccent]}>Feeling good day</Text>
          <Text style={styles.cardStat}>
            {goodEnergy.exerciseCount} <Text style={styles.cardStatUnit}>exercises</Text> · {goodEnergy.durationMin}{' '}
            <Text style={styles.cardStatUnit}>min</Text>
          </Text>
          <Text style={styles.cardExplanation}>{goodEnergy.explanation}</Text>
        </ReanimatedAnimated.View>

        <ReanimatedAnimated.Text entering={FadeIn.duration(350).delay(680)} style={styles.closingLine}>
          This happens automatically, every day. You won't have to guess.
        </ReanimatedAnimated.Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleCreateAccount}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View style={[styles.primaryButtonVisual, { transform: [{ scale: ctaPress.scale }] }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: ctaHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.hoverWash,
                { opacity: ctaPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
              ]}
            />
            <Text style={styles.primaryText}>Create your account</Text>
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
    paddingHorizontal: 40,
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: 'center',
    fontFamily: 'Geist-Bold',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Headline wraps to two lines at this width/weight (188 + 28*2 = 244),
    // so this has to clear that, not just a single-line title.
    top: 254,
    color: '#9a9a9a',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Geist-Medium',
  },
  card: {
    position: 'absolute',
    left: 16,
    top: 284,
    width: 343,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0C0C0C',
    overflow: 'hidden',
  },
  // A static, subtle top-edge highlight — same treatment as every other
  // card surface redesigned this pass.
  cardSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardSecond: {
    top: 412,
    borderColor: 'rgba(67,140,99,0.5)',
  },
  cardLabel: {
    color: '#9a9a9a',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: 'Geist-SemiBold',
  },
  cardLabelAccent: {
    color: '#438C63',
  },
  cardStat: {
    marginTop: 8,
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Geist-Bold',
  },
  cardStatUnit: {
    color: '#7a7a7a',
    fontSize: 12,
    fontWeight: '500',
  },
  cardExplanation: {
    marginTop: 8,
    color: '#b0b0b0',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Geist-Regular',
  },
  closingLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 552,
    paddingHorizontal: 48,
    color: '#d0d0d0',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Geist-Medium',
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
