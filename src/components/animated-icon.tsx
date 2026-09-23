import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Appearance, Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MOTION_EASING } from '@/lib/motion';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
// Read once at module load — before AppThemeProvider applies the in-app
// theme override via Appearance.setColorScheme — so this is the DEVICE's
// appearance, the only thing the native splash (drawn before any JS runs)
// can ever follow. Matching it exactly is what makes the native→JS handoff
// invisible; the fade below then reveals the app in the user's own theme,
// a cross-fade instead of a hard black/white flip when the two differ.
const LAUNCH_DEVICE_SCHEME = Appearance.getColorScheme();

/**
 * BUG FIX: this used to be a hardcoded blue (#208AEF, matching app.json's
 * native splash background) regardless of the device's theme — a jarring
 * blue flash for a dark-mode user used to an otherwise all-black/white app.
 * Now plain black/white matching the device appearance the native splash
 * itself used (see LAUNCH_DEVICE_SCHEME) — not this app's brand blue, since
 * the point is to disappear into the handoff, not to make a brand statement
 * on the one screen with zero user-visible chrome to react to.
 *
 * No logo mark, by explicit request — this used to animate the brand
 * glyph in from the native splash; now it's just the theme-matched color
 * fill, nothing else. The two-phase structure (a plain View first, an
 * Animated.View second) is still needed even without an image: the first
 * render's onLayout is what actually calls SplashScreen.hideAsync() (the
 * native splash needs a real frame already on screen underneath it before
 * it can hide without a flash), and Reanimated's `entering` animation only
 * plays for a component that's freshly mounting — using it on the very
 * first render wouldn't produce the intended hold-then-fade.
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const overlayStyle = [styles.splashOverlay, { backgroundColor: LAUNCH_DEVICE_SCHEME === 'dark' ? '#000000' : '#ffffff' }];

  const fadeKeyframe = new Keyframe({
    0: {
      opacity: 1,
    },
    70: {
      opacity: 1,
    },
    100: {
      opacity: 0,
      // Was Easing.elastic — an overshooting curve on an opacity fade
      // oscillates around 0 at the very end, which reads as a flicker.
      easing: MOTION_EASING.standard,
    },
  });

  return animate ? (
    <Animated.View
      entering={fadeKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={overlayStyle}
    />
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={overlayStyle}
    />
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    // No backgroundColor here on purpose — AnimatedSplashOverlay always
    // supplies the real, theme-resolved black/white as a second style
    // array entry, so a value here would just be dead code shadowed on
    // every render.
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
