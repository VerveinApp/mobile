import { router } from 'expo-router';
import { useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight } from '@/lib/haptics';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import { PadlockIconGraphic, UserIconGraphic } from '@/components/auth/onboarding-graphics';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

export default function OnboardingNameScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  const entering = useFadeInEntering();
  const continueHover = useHoverFade();
  const continuePress = useLiquidPress();

  const isNameEmpty = name.trim().length === 0;

  const handleContinue = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Tell us what to call you.');
      hapticError();
      return;
    }
    setNameError(null);
    hapticImpactLight();
    saveOnboardingDraft({ step: 2, params: { name: trimmed } });
    router.push({ pathname: '/onboarding/step-2', params: { name: trimmed } } as never);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <OnboardingProgress step={1} />

        <View style={styles.logoMark} pointerEvents="none">
          <View style={styles.logoAccent}>
            <LogoMarkAccentGraphic width={45.32} height={52.31} />
          </View>
          <View style={styles.logoCheck}>
            <LogoMarkGraphic width={33.99} height={44.75} />
          </View>
        </View>

        <Text style={styles.title}>
          {'Let’s get to know\n'}
          <Text style={styles.titleAccent}>you better</Text>
        </Text>

        <Text style={styles.subtitle}>
          This helps us personalize ur experience & recommendations.
        </Text>

        <View style={[styles.inputWrap, nameFocused && styles.inputWrapFocused]}>
          <View style={styles.inputIcon}>
            <UserIconGraphic size={16} />
          </View>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (nameError) setNameError(null);
            }}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="What should we call you?"
            placeholderTextColor="#a3a3a3"
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="givenName"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>

        {nameError ? (
          <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.errorText}>
            {nameError}
          </ReanimatedAnimated.Text>
        ) : null}

        <Pressable
          style={styles.primaryButtonHit}
          onPress={handleContinue}
          disabled={isNameEmpty}
          onHoverIn={continueHover.onHoverIn}
          onHoverOut={continueHover.onHoverOut}
          onPressIn={continuePress.onPressIn}
          onPressOut={continuePress.onPressOut}
        >
          <Animated.View
            style={[
              styles.primaryButtonVisual,
              isNameEmpty && styles.primaryButtonDisabled,
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

        <View style={styles.privacyRow} pointerEvents="none">
          <PadlockIconGraphic size={11.31} />
          <Text style={styles.privacyText}>Your information is private and secure.</Text>
        </View>
      </ReanimatedAnimated.View>
      </View>
    </KeyboardAvoidingView>
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
    left: 87,
    top: 188,
    width: 204,
    color: '#ffffff',
    fontSize: 22.957,
    lineHeight: 34.43,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'System',
  },
  titleAccent: {
    color: '#438C63',
    fontSize: 28,
  },
  subtitle: {
    position: 'absolute',
    left: 96,
    top: 274,
    width: 186,
    color: '#b0b0b0',
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'System',
  },
  inputWrap: {
    position: 'absolute',
    left: 46,
    top: 415,
    width: 285,
    height: 40,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BDBDBD',
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  inputWrapFocused: {
    borderColor: '#438C63',
  },
  inputIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    marginLeft: 6,
    padding: 0,
    color: '#f5f5f5',
    fontSize: 10.19,
    fontWeight: '500',
    fontFamily: 'System',
  },
  errorText: {
    position: 'absolute',
    left: 46,
    top: 458,
    width: 285,
    textAlign: 'center',
    color: '#e5484d',
    fontSize: 9,
    fontWeight: '400',
    fontFamily: 'System',
  },
  primaryButtonHit: {
    position: 'absolute',
    left: 46,
    top: 497,
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
    fontWeight: '500',
    fontFamily: 'System',
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
  privacyRow: {
    position: 'absolute',
    left: 110,
    top: 608,
    width: 156.69,
    height: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: {
    marginLeft: 4,
    color: '#a3a3a3',
    fontSize: 7,
    fontWeight: '500',
    fontFamily: 'System',
  },
});
