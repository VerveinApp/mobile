import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticImpactLight } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { ButtonGlassSurface, isButtonGlassAvailable } from '@/components/ui/button-glass-surface';
import { EnergyGauge, type EnergyScore } from '@/components/home/energy-gauge';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

/**
 * TEMPORARY stand-in for Home — wired in as the real post-onboarding entry
 * point ((tabs)/index.tsx) for now, but this is not the full Home
 * experience (no adapted-workout resolve state, no rest-day framing, no
 * explanation string). Replace with the real Home screen when that's built.
 */
export default function EnergyCheckInScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const [energy, setEnergy] = useState<EnergyScore | null>(null);

  const entering = useFadeInEntering();
  const ctaHover = useHoverFade();
  const ctaPress = useLiquidPress();

  const handleContinue = () => {
    if (energy === null) return;
    hapticImpactLight();
    // TODO: hand energy off to the real check-in / adaptation call once the engine is wired up.
  };

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={45.32} height={52.31} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={33.99} height={44.75} />
          </View>
        </View>

        <Text style={styles.title}>
          {"How's your "}
          <Text style={styles.titleAccent}>energy</Text>
          {' today?'}
        </Text>
        <Text style={styles.subtitle}>Your plan adapts to what you tell it.</Text>

        <View style={styles.gaugeWrap}>
          <EnergyGauge size={260} canvasScale={scale} value={energy} onChange={setEnergy} />
        </View>

        {energy !== null ? (
          <ReanimatedAnimated.Text entering={FadeIn.duration(250)} style={styles.moved}>
            You've moved 3 times this week.
          </ReanimatedAnimated.Text>
        ) : null}

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          disabled={energy === null}
          onHoverIn={ctaHover.onHoverIn}
          onHoverOut={ctaHover.onHoverOut}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isButtonGlassAvailable && styles.primaryButtonVisualGlass,
              energy === null && styles.primaryButtonDisabled,
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
            <Text style={styles.primaryText}>Start session</Text>
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
    top: 180,
    paddingHorizontal: 44,
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: 'center',
    fontFamily: 'Geist-Bold',
  },
  titleAccent: {
    color: '#438C63',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 246,
    color: '#9a9a9a',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Geist-Regular',
  },
  gaugeWrap: {
    position: 'absolute',
    left: (CANVAS_WIDTH - 260) / 2,
    top: 280,
    alignItems: 'center',
  },
  moved: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 500,
    color: '#7a7a7a',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'Geist-Regular',
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
