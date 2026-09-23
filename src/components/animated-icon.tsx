import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Appearance, StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MOTION_EASING } from '@/lib/motion';

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

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    // No backgroundColor here on purpose — AnimatedSplashOverlay always
    // supplies the launch-appearance black/white as a second style array
    // entry, so a value here would just be dead code shadowed on every
    // render.
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
