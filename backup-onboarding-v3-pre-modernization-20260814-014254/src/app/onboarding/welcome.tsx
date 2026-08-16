import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';
import { ButtonGlassSurface, isButtonGlassAvailable } from '@/components/ui/button-glass-surface';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * The app's true first screen — reached only by a fresh user with no draft
 * and no completed profile (see the entry router in (tabs)/index.tsx). Sets
 * the frame before onboarding asks anything: same brand lockup as the
 * account-creation screen at the other end of the flow, so the identity
 * bookends the whole experience rather than only showing up at signup.
 */
export default function OnboardingWelcomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const entering = useFadeInEntering();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const handleGetStarted = () => {
    hapticImpactLight();
    router.push('/onboarding' as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <View style={styles.brandBlock} pointerEvents="none">
          <View style={styles.brandAccent}>
            <LogoMarkAccentGraphic />
          </View>
          <View style={styles.brandMark}>
            <LogoMarkGraphic />
          </View>
          <View style={styles.brandWordmark}>
            <WordmarkTextGraphic />
          </View>
        </View>

        <Text style={styles.kicker}>Adaptive Fitness Engine</Text>

        <Text style={styles.title}>
          {'Fitness built around\n'}
          <Text style={styles.titleAccent}>your journey.</Text>
        </Text>

        <Text style={styles.subtitle}>
          {'Your training adapts to you,\n'}
          not the other way around.
        </Text>

        <Text style={styles.teaser}>See your plan adapt to how you feel — before you sign up.</Text>

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleGetStarted}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isButtonGlassAvailable && styles.primaryButtonVisualGlass,
              { transform: [{ scale: ctaPress.scale }] },
            ]}
          >
            <ButtonGlassSurface borderRadius={6} />
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
            <Text style={styles.primaryText}>Get started</Text>
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
    left: -210,
    top: -147,
  },
  brandBlock: {
    position: 'absolute',
    left: (CANVAS_WIDTH - 116) / 2,
    top: 260,
    width: 116,
    height: 41,
  },
  brandAccent: {
    position: 'absolute',
    left: 0,
    top: 4.53,
  },
  brandMark: {
    position: 'absolute',
    left: 23.34,
    top: 0,
  },
  brandWordmark: {
    position: 'absolute',
    left: 32.82,
    top: 19,
  },
  kicker: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 312,
    color: '#5c5c5c',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: 'Geist-Medium',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 348,
    paddingHorizontal: 48,
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    textAlign: 'center',
    fontFamily: 'Geist-Bold',
  },
  titleAccent: {
    color: '#2f6647',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 432,
    paddingHorizontal: 56,
    color: '#b0b0b0',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Geist-Regular',
  },
  teaser: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 492,
    paddingHorizontal: 64,
    color: '#438C63',
    fontSize: 11.5,
    lineHeight: 17,
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
  primaryButtonVisualGlass: {
    backgroundColor: 'rgba(41,86,58,0.4)',
    borderWidth: 0,
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
