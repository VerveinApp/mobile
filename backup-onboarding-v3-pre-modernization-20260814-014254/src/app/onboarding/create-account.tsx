import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { goBack } from '@/lib/onboarding-nav';
import { markOnboardingComplete } from '@/lib/onboarding-draft';
import { ButtonGlassSurface, isButtonGlassAvailable } from '@/components/ui/button-glass-surface';
import {
  AppleIconGraphic,
  ArrowUpIconGraphic,
  CardFrameGraphic,
  GlowGraphic,
  GoogleIconGraphic,
  InputFieldGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
  MailIconGraphic,
  WordmarkTextGraphic,
} from '@/components/auth/create-account-graphics';
import { BackArrowGraphic } from '@/components/auth/verify-email-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The last screen in onboarding, not the first — reached only after the
 * First Look demo. All accumulated onboarding answers arrive as route
 * params and ride forward through verification so nothing entered earlier
 * is lost at account creation.
 */
export default function CreateAccountScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;

  const onboardingParams = useLocalSearchParams<Record<string, string>>();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  const continueHover = useHoverFade();
  const appleHover = useHoverFade();
  const googleHover = useHoverFade();

  const continuePress = useLiquidPress();
  const applePress = useLiquidPress();
  const googlePress = useLiquidPress();

  const isEmailEmpty = email.trim().length === 0;

  // Reached from whichever payoff screen the consent branch sent the user
  // to (see step-9) — go back to that same one, not a hardcoded screen.
  const handleBack = () => {
    const previous = onboardingParams.healthConsent === 'true' ? '/onboarding/potential' : '/onboarding/first-look';
    goBack(previous, onboardingParams);
  };

  const handleContinue = () => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      hapticError();
      return;
    }
    setEmailError(null);
    hapticImpactLight();
    // Manual email sign-in is the only path that goes through verification.
    // All onboarding answers ride along so verify.tsx can hand them to the
    // post-signup destination once the account is confirmed.
    router.push({ pathname: '/auth/verify', params: { ...onboardingParams, email: trimmed } } as never);
  };

  // Apple/Google are separate auth paths — they intentionally skip email
  // verification. Not implemented yet (no backend/SDK integration), so
  // these are placeholders that preserve the correct routing shape: once
  // wired up, a real success callback replaces this immediate completion.
  const handleAppleAuth = () => {
    hapticImpactLight();
    // TODO: integrate Sign in with Apple, then call markOnboardingComplete on success.
    markOnboardingComplete();
    router.replace('/(tabs)' as never);
  };

  const handleGoogleAuth = () => {
    hapticImpactLight();
    // TODO: integrate Google auth, then call markOnboardingComplete on success.
    markOnboardingComplete();
    router.replace('/(tabs)' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={12}>
          <BackArrowGraphic />
        </Pressable>

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

        <Text style={styles.title}>
          {'Fitness built around\n'}
          <Text style={styles.titleAccent}>your journey.</Text>
        </Text>

        <Text style={styles.subtitle}>
          {'Your training adapts to you,\n'}
          not the other way around.
        </Text>

        <View style={styles.cardFrame} pointerEvents="none">
          {/* Apple/Google pills render per-button below (so they can move with the press
              animation) instead of as part of this static card background. */}
          <CardFrameGraphic showButtonSlots={false} />
        </View>

        <View style={styles.card}>
          <Text style={styles.formHeading}>Enter your email</Text>
          <Text style={styles.fieldLabel}>Email address</Text>

          <View style={styles.inputWrap}>
            <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
              <InputFieldGraphic />
            </View>
            <View
              pointerEvents="none"
              style={[styles.inputFocusRing, emailFocused && styles.inputFocusRingActive]}
            />
            <MailIconGraphic width={13} height={10.11} />
            <TextInput
              style={styles.inputText}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) setEmailError(null);
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor="#a3a3a3"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              underlineColorAndroid="transparent"
            />
          </View>

          {emailError ? (
            <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.errorText}>
              {emailError}
            </ReanimatedAnimated.Text>
          ) : null}

          <Pressable
            style={styles.primaryButtonHit}
            onPress={handleContinue}
            disabled={isEmailEmpty}
            onHoverIn={continueHover.onHoverIn}
            onHoverOut={continueHover.onHoverOut}
            onPressIn={continuePress.onPressIn}
            onPressOut={continuePress.onPressOut}
          >
            <Animated.View
              style={[
                styles.primaryButtonVisual,
                isButtonGlassAvailable && styles.primaryButtonVisualGlass,
                isEmailEmpty && styles.primaryButtonDisabled,
                { transform: [{ scale: continuePress.scale }] },
              ]}
            >
              <ButtonGlassSurface borderRadius={6} />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: continueHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: continuePress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }) },
                ]}
              />
              <Text style={styles.primaryText}>Continue</Text>
              <View style={styles.buttonArrow}>
                <ArrowUpIconGraphic size={24} />
              </View>
            </Animated.View>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.socialButtonHit}
            onPress={handleAppleAuth}
            onHoverIn={appleHover.onHoverIn}
            onHoverOut={appleHover.onHoverOut}
            onPressIn={applePress.onPressIn}
            onPressOut={applePress.onPressOut}
          >
            <Animated.View style={[styles.socialButtonVisual, { transform: [{ scale: applePress.scale }] }]}>
              <ButtonGlassSurface borderRadius={6} tintColor="#161616" />
              {/* This button's own pill — the shared CardFrameGraphic no longer draws it,
                  so the whole box (fill + border) scales and glows together on press.
                  zIndex keeps these overlays behind the icon/text on every platform. */}
              <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
                <InputFieldGraphic
                  width={285}
                  height={35}
                  fill={isButtonGlassAvailable ? 'rgba(12,12,12,0.35)' : undefined}
                  stroke={isButtonGlassAvailable ? 'transparent' : undefined}
                />
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: appleHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: applePress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) },
                ]}
              />
              <AppleIconGraphic width={15.17} height={18} />
              <Text style={[styles.socialText, styles.appleText]}>Continue with Apple</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.socialButtonGoogleHit}
            onPress={handleGoogleAuth}
            onHoverIn={googleHover.onHoverIn}
            onHoverOut={googleHover.onHoverOut}
            onPressIn={googlePress.onPressIn}
            onPressOut={googlePress.onPressOut}
          >
            <Animated.View style={[styles.socialButtonVisual, { transform: [{ scale: googlePress.scale }] }]}>
              <ButtonGlassSurface borderRadius={6} tintColor="#161616" />
              {/* This button's own pill — the shared CardFrameGraphic no longer draws it,
                  so the whole box (fill + border) scales and glows together on press.
                  zIndex keeps these overlays behind the icon/text on every platform. */}
              <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
                <InputFieldGraphic
                  width={285}
                  height={35}
                  fill={isButtonGlassAvailable ? 'rgba(12,12,12,0.35)' : undefined}
                  stroke={isButtonGlassAvailable ? 'transparent' : undefined}
                />
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: googleHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.hoverWash,
                  styles.behindContent,
                  { opacity: googlePress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) },
                ]}
              />
              <GoogleIconGraphic size={16} />
              <Text style={[styles.socialText, styles.googleText]}>Continue with Google</Text>
            </Animated.View>
          </Pressable>
        </View>

        <Text style={styles.termsText}>
          {'By continuing, you agree to Vervein’s\n'}
          <Text
            style={styles.termsLink}
            // Placeholder route — the legal screen doesn't exist yet.
            onPress={() => router.push('/legal/terms' as never)}
          >
            Terms of Service
          </Text>
          <Text> and </Text>
          <Text
            style={styles.termsLink}
            // Placeholder route — the legal screen doesn't exist yet.
            onPress={() => router.push('/legal/privacy' as never)}
          >
            Privacy Policy
          </Text>
          <Text>.</Text>
        </Text>
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
  glow: {
    position: 'absolute',
    left: -210,
    top: -147,
  },
  backButton: {
    position: 'absolute',
    left: 11,
    top: 33,
    width: 27,
    height: 27,
  },
  brandBlock: {
    position: 'absolute',
    left: 31,
    top: 93,
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
  title: {
    position: 'absolute',
    left: 34,
    top: 160,
    // Widened from 268.86: Geist renders this headline wider than the
    // system font the original width was tuned for, wrapping "Fitness
    // built around" onto two lines at the old width.
    width: 320,
    color: '#ffffff',
    fontSize: 30.478,
    lineHeight: 34,
    letterSpacing: -0.3048,
    fontFamily: 'Geist-SemiBold',
  },
  titleAccent: {
    color: '#2f6647',
    fontSize: 32,
    letterSpacing: -0.32,
  },
  subtitle: {
    position: 'absolute',
    left: 31,
    top: 275,
    color: '#b0b0b0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Geist-Regular',
  },
  cardFrame: {
    position: 'absolute',
    left: 26,
    top: 355,
  },
  card: {
    position: 'absolute',
    left: 26,
    top: 355,
    width: 326,
    height: 322,
  },
  formHeading: {
    position: 'absolute',
    left: 17,
    top: 21,
    color: '#f5f5f5',
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
  },
  fieldLabel: {
    position: 'absolute',
    left: 17,
    top: 51,
    color: '#f5f5f5',
    fontSize: 10.5,
    fontFamily: 'Geist-Regular',
  },
  inputWrap: {
    position: 'absolute',
    left: 19,
    top: 71,
    width: 285,
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  inputText: {
    flex: 1,
    marginLeft: 6,
    padding: 0,
    color: '#a3a3a3',
    fontSize: 10.187,
    fontFamily: 'Geist-Regular',
  },
  inputFocusRing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocusRingActive: {
    borderColor: '#438C63',
  },
  errorText: {
    position: 'absolute',
    left: 19,
    top: 109,
    color: '#e5484d',
    fontSize: 9,
    fontFamily: 'Geist-Regular',
  },
  primaryButtonHit: {
    position: 'absolute',
    left: 19,
    top: 133,
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
  // The Liquid Glass layer supplies its own edge highlight and translucent
  // material, so the flat fill backs off to a thin tint (letting the glass
  // read through) and the artificial 1px border drops out entirely.
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
    right: 16,
    top: 7,
    transform: [{ rotate: '90deg' }],
  },
  hoverWash: {
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  behindContent: {
    zIndex: -1,
  },
  dividerRow: {
    position: 'absolute',
    left: 14,
    top: 198,
    width: 295,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dividerLine: {
    width: 120,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dividerText: {
    color: '#7e7e7e',
    fontSize: 10,
    fontFamily: 'Geist-Medium',
  },
  socialButtonHit: {
    position: 'absolute',
    left: 19,
    top: 212,
    width: 285,
    height: 35,
  },
  socialButtonGoogleHit: {
    position: 'absolute',
    left: 19,
    top: 261,
    width: 285,
    height: 35,
  },
  socialButtonVisual: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: {
    marginLeft: 10,
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
  },
  appleText: {
    color: '#ffffff',
  },
  googleText: {
    color: '#ffffff',
    fontSize: 11,
    letterSpacing: 0.33,
  },
  termsText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 741,
    color: '#828282',
    fontSize: 9.261,
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: 'Geist-Regular',
  },
  termsLink: {
    color: '#438C63',
    fontFamily: 'Geist-Medium',
  },
});
