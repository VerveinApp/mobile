import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSuccess } from '@/lib/haptics';
import { goBack } from '@/lib/onboarding-nav';
import { signInWithApple, signInWithGoogle } from '@/lib/social-auth';
import { supabase } from '@/lib/supabase';
import { finishOnboarding } from '@/lib/user-profile';
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
import { useAppTheme } from '@/lib/theme-context';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Liquid Glass is otherwise reserved for exactly one place (the EnergyGauge
// dial) so it reads as a deliberate "this moment matters" cue, not
// decoration. Account creation is the other moment that earns it.
const isGlassAvailable = isLiquidGlassAvailable();

/**
 * The last screen in onboarding, not the first — reached only after the
 * First Look demo. All accumulated onboarding answers arrive as route
 * params and ride forward through verification so nothing entered earlier
 * is lost at account creation.
 */
export default function CreateAccountScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const hoverWashColor = isDark ? '#ffffff' : '#000000';
  const styles = useMemo(() => createStyles(colors, hoverWashColor), [colors, hoverWashColor]);

  const onboardingParams = useLocalSearchParams<Record<string, string>>();

  // True only when THIS navigation chain carries a real verifiedEmail param
  // — see onboarding/index.tsx's own doc comment for why that's threaded
  // forward as an ordinary route param (like `name`), not a global, time-
  // based AsyncStorage flag: welcome.tsx's "Sign in" path verifies an email
  // BEFORE any onboarding answers exist, then auth/verify.tsx sends that
  // exact chain through the full questionnaire with `verifiedEmail`
  // attached at every step, ending here again. Only a chain that actually
  // carries it can skip straight to finishing onboarding instead of
  // sending and re-entering a second OTP code for an email this device
  // already proved ownership of moments earlier — an unrelated "Get
  // Started" chain never has this param, so it always reaches the real
  // email form below.
  //
  // BUG FIX: this used to read a device-wide AsyncStorage flag
  // (onboarding-draft.ts's now-removed savePendingVerifiedEmail/
  // takePendingVerifiedEmail, expiring only after 30 minutes) instead of a
  // route param. On a shared/family device, an abandoned "Sign in" attempt
  // could leave that flag valid for up to 30 minutes — long enough for a
  // second, completely unrelated "Get Started" signup on the same device to
  // land here, silently consume the first person's already-verified email,
  // and finish with the WRONG email attached, never showing an email form
  // at all. Route params can't leak across unrelated navigation chains the
  // way a global flag can, which is what actually closes this.
  // A plain derived const, not state — it's fixed by whatever this screen
  // mounted with and never needs to flip back: when true, the effect below
  // always either navigates away (all-set) before render matters again, so
  // there's no "resolved, show the form now" transition for a setter to
  // drive.
  const checkingVerifiedEmail = !!onboardingParams.verifiedEmail;
  // BUG FIX: finishOnboarding (an AsyncStorage write) has no guaranteed
  // success — a real write failure here used to leave this screen rendering
  // `null` forever with no error, no retry, and no way forward short of
  // force-quitting, since checkingVerifiedEmail itself never had a way back
  // to false once it started true. This flag is that way back: only ever
  // set on a genuine failure, letting the gate below fall through to the
  // real email form as a manual fallback instead of a permanent blank screen.
  const [verifiedEmailFinishFailed, setVerifiedEmailFinishFailed] = useState(false);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  // Real error surface for handleAppleAuth/handleGoogleAuth below — no
  // longer a permanent "not set up yet" notice now that both are wired to
  // real SDK calls, but a real provider/network failure still needs
  // somewhere honest to show up rather than silently doing nothing.
  const [socialAuthNotice, setSocialAuthNotice] = useState<string | null>(null);
  // Guards both handlers against a double-tap firing two concurrent native
  // sheets/browser sessions. BUG FIX: this used to be a single useState
  // boolean checked-then-set inside each async handler — but two fast taps
  // can both read the same stale `false` before React commits the first
  // tap's setState, since state updates aren't synchronous across separate
  // event-handler invocations. The ref is the real, synchronous gate (immune
  // to two calls landing before either has a chance to observe the other's
  // write); the state twin only drives the buttons' visual disabled style.
  // Same ref+state-twin pattern as check-in.tsx's isStartingSessionRef/
  // isFinishingSessionRef.
  const isSocialAuthInProgressRef = useRef(false);
  const [isSocialAuthInProgress, setIsSocialAuthInProgress] = useState(false);

  useEffect(() => {
    if (!onboardingParams.verifiedEmail) return;
    (async () => {
      try {
        await finishOnboarding(onboardingParams, onboardingParams.verifiedEmail);
        hapticSuccess();
        router.replace('/onboarding/all-set' as never);
      } catch {
        setSocialAuthNotice("Something went wrong finishing setup — enter your email below to try again.");
        setVerifiedEmailFinishFailed(true);
      }
    })();
    // Intentionally empty — this is a one-time check for whatever params
    // this screen mounted with, not a subscription that should re-run if
    // onboardingParams' identity happens to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueHover = useHoverFade();
  const appleHover = useHoverFade();
  const googleHover = useHoverFade();

  const continuePress = useLiquidPress();
  const applePress = useLiquidPress();
  const googlePress = useLiquidPress();

  const isEmailEmpty = email.trim().length === 0;

  // Both branches converge on First Look now (see step-7's handleBuildPlan
  // — the consent-only potential-score payoff was cut), so this is always
  // the same screen regardless of healthConsent.
  const handleBack = () => {
    goBack('/onboarding/first-look', onboardingParams);
  };

  const handleContinue = async () => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      hapticError();
      return;
    }
    setEmailError(null);
    hapticImpactLight();
    setSendingCode(true);
    // The real send — previously this just navigated to verify.tsx without
    // ever dispatching a code anywhere, which is how that screen used to
    // accept literally any 4 digits typed in.
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    setSendingCode(false);
    if (error) {
      setEmailError(error.message);
      hapticError();
      return;
    }
    // Manual email sign-in is the only path that goes through verification.
    // All onboarding answers ride along so verify.tsx can hand them to the
    // post-signup destination once the account is confirmed.
    router.push({ pathname: '/auth/verify', params: { ...onboardingParams, email: trimmed } } as never);
  };

  // Real Apple/Google sign-in (replaces the old honest "not set up yet"
  // placeholder — see social-auth.ts's own doc comment for the actual
  // provider calls). Apple/Google each verify identity themselves before
  // this ever resolves 'success', so neither path goes through
  // handleContinue's email-OTP screen at all — that's the whole point of
  // using a real identity provider, not a shortcut around verification.
  //
  // Same branch `handleContinue`'s email path effectively defers to
  // verify.tsx for: does this navigation chain carry a real, full
  // questionnaire (onboardingParams.name present — this device already
  // answered everything and just needs an identity to finish with), or is
  // this welcome.tsx's bare "Sign in" path (no local profile, no answers
  // collected yet)? The full-questionnaire case finishes immediately, same
  // as verify.tsx's own mid-onboarding branch. The bare case can't finish
  // onboarding with no real answers to save, so it routes into the real
  // questionnaire instead — carrying the now-verified email forward as an
  // ordinary route param (see onboarding/index.tsx's own doc comment for
  // why that's a route param, not a global flag) so this screen's own
  // mount effect above skips straight through when that chain reaches here
  // again at the end.
  const handleSocialAuthSuccess = async (email: string) => {
    hapticSuccess();
    if (onboardingParams.name) {
      await finishOnboarding(onboardingParams, email);
      router.replace('/onboarding/all-set' as never);
    } else {
      router.replace({ pathname: '/onboarding', params: { verifiedEmail: email } } as never);
    }
  };

  const handleAppleAuth = async () => {
    if (isSocialAuthInProgressRef.current) return;
    isSocialAuthInProgressRef.current = true;
    hapticImpactLight();
    setIsSocialAuthInProgress(true);
    setSocialAuthNotice(null);
    const result = await signInWithApple();
    isSocialAuthInProgressRef.current = false;
    setIsSocialAuthInProgress(false);
    if (result.kind === 'success') {
      await handleSocialAuthSuccess(result.email);
    } else if (result.kind === 'error') {
      hapticError();
      setSocialAuthNotice(result.message);
    }
    // 'cancelled' — the user backed out of Apple's own sheet, the most
    // common outcome. No error, nothing to say.
  };

  const handleGoogleAuth = async () => {
    if (isSocialAuthInProgressRef.current) return;
    isSocialAuthInProgressRef.current = true;
    hapticImpactLight();
    setIsSocialAuthInProgress(true);
    setSocialAuthNotice(null);
    const result = await signInWithGoogle();
    isSocialAuthInProgressRef.current = false;
    setIsSocialAuthInProgress(false);
    if (result.kind === 'success') {
      await handleSocialAuthSuccess(result.email);
    } else if (result.kind === 'error') {
      hapticError();
      setSocialAuthNotice(result.message);
    }
    // 'cancelled' — the user closed the browser sheet, the most common
    // outcome. No error, nothing to say.
  };

  if (checkingVerifiedEmail && !verifiedEmailFinishFailed) return null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
        {isDark ? (
          <View style={styles.glow} pointerEvents="none">
            <GlowGraphic />
          </View>
        ) : null}

        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackArrowGraphic color={colors.text} />
        </Pressable>

        <View style={styles.brandBlock} pointerEvents="none">
          <View style={styles.brandAccent}>
            <LogoMarkAccentGraphic width={35.8156} height={45.1325} color={colors.text} />
          </View>
          <View style={styles.brandMark}>
            <LogoMarkGraphic width={27.2695} height={38.3516} color={colors.text} />
          </View>
          <View style={styles.brandWordmark}>
            <WordmarkTextGraphic height={27.25} color={colors.text} />
          </View>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {'Fitness built around\n'}
          <Text style={styles.titleAccent}>your journey.</Text>
        </Text>

        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          {'Your training adapts to you,\n'}
          not the other way around.
        </Text>

        <View style={styles.cardFrame} pointerEvents="none">
          {/* Apple/Google pills render per-button below (so they can move with the press
              animation) instead of as part of this static card background. */}
          <CardFrameGraphic showButtonSlots={false} fill={colors.surface} stroke={colors.surfaceBorder} />
        </View>

        <View style={styles.card}>
          <Text style={styles.formHeading} maxFontSizeMultiplier={1.3}>Enter your email</Text>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Email address</Text>

          <View style={styles.inputWrap}>
            <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
              <InputFieldGraphic fill={colors.surface} stroke={colors.surfaceBorder} />
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
                if (socialAuthNotice) setSocialAuthNotice(null);
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
            <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.errorText} maxFontSizeMultiplier={1.3}>
              {emailError}
            </ReanimatedAnimated.Text>
          ) : null}

          <Pressable
            style={styles.primaryButtonHit}
            onPress={handleContinue}
            disabled={isEmailEmpty || sendingCode}
            onHoverIn={continueHover.onHoverIn}
            onHoverOut={continueHover.onHoverOut}
            onPressIn={continuePress.onPressIn}
            onPressOut={continuePress.onPressOut}
          >
            <Animated.View
              style={[
                styles.primaryButtonVisual,
                isGlassAvailable && styles.primaryButtonVisualGlass,
                (isEmailEmpty || sendingCode) && styles.primaryButtonDisabled,
                { transform: [{ scale: continuePress.scale }] },
              ]}
            >
              {isGlassAvailable ? (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  tintColor="#1c3d29"
                  style={[StyleSheet.absoluteFill, styles.behindContent, { borderRadius: 6 }]}
                />
              ) : null}
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
              <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>
                {sendingCode ? 'Sending…' : 'Continue'}
              </Text>
              {sendingCode ? null : (
                <View style={styles.buttonArrow}>
                  <ArrowUpIconGraphic size={24} />
                </View>
              )}
            </Animated.View>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText} maxFontSizeMultiplier={1.2}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.socialButtonHit}
            onPress={handleAppleAuth}
            disabled={isSocialAuthInProgress}
            onHoverIn={appleHover.onHoverIn}
            onHoverOut={appleHover.onHoverOut}
            onPressIn={applePress.onPressIn}
            onPressOut={applePress.onPressOut}
          >
            <Animated.View style={[styles.socialButtonVisual, { transform: [{ scale: applePress.scale }] }]}>
              {/* This button's own pill — the shared CardFrameGraphic no longer draws it,
                  so the whole box (fill + border) scales and glows together on press.
                  zIndex keeps these overlays behind the icon/text on every platform. */}
              <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
                <InputFieldGraphic width={285} height={35} fill={colors.surface} stroke={colors.surfaceBorder} />
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
              <AppleIconGraphic width={15.17} height={18} color={colors.text} />
              <Text style={[styles.socialText, styles.appleText]} maxFontSizeMultiplier={1.2}>Continue with Apple</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.socialButtonGoogleHit}
            onPress={handleGoogleAuth}
            disabled={isSocialAuthInProgress}
            onHoverIn={googleHover.onHoverIn}
            onHoverOut={googleHover.onHoverOut}
            onPressIn={googlePress.onPressIn}
            onPressOut={googlePress.onPressOut}
          >
            <Animated.View style={[styles.socialButtonVisual, { transform: [{ scale: googlePress.scale }] }]}>
              {/* This button's own pill — the shared CardFrameGraphic no longer draws it,
                  so the whole box (fill + border) scales and glows together on press.
                  zIndex keeps these overlays behind the icon/text on every platform. */}
              <View style={[StyleSheet.absoluteFill, styles.behindContent]} pointerEvents="none">
                <InputFieldGraphic width={285} height={35} fill={colors.surface} stroke={colors.surfaceBorder} />
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
              <Text style={[styles.socialText, styles.googleText]} maxFontSizeMultiplier={1.2}>Continue with Google</Text>
            </Animated.View>
          </Pressable>

          {socialAuthNotice ? (
            <ReanimatedAnimated.Text
              entering={FadeIn.duration(150)}
              style={styles.socialNoticeText}
              maxFontSizeMultiplier={1.3}
            >
              {socialAuthNotice}
            </ReanimatedAnimated.Text>
          ) : null}
        </View>

        <Text style={styles.termsText} maxFontSizeMultiplier={1.4}>
          {'By continuing, you agree to VerveIn’s\n'}
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

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], hoverWashColor: string) {
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
    // 25% larger than the original 116×41 lockup, recentered around the
    // same visual midpoint (top shifted up by half the added height) so it
    // grows evenly instead of just extending down toward the title below —
    // same treatment as welcome.tsx's matching lockup.
    brandBlock: {
      position: 'absolute',
      left: 31,
      top: 87.88,
      width: 145,
      height: 51.25,
    },
    // Shifted +5.16 right (0 -> 5.16): a true nearest-point pixel measurement
    // (not a column scan) showed the icon-to-"e" gap sitting at ~9.16pt on
    // device, more than double Figma's real ~4.0pt gap between the same two
    // shapes. Moving the icon closer to the fixed wordmark position closes
    // that gap without touching.
    brandAccent: {
      position: 'absolute',
      left: 5.16,
      top: 5.66,
    },
    brandMark: {
      position: 'absolute',
      left: 34.34,
      top: 0,
    },
    // Box-position math against Figma's CSS said 41.03 was correct, but the
    // wordmark SVG's left-bearing doesn't match Figma's live text layer, so
    // that value fused the icon into the "e" with zero gap on device. Shifted
    // to 45.45 against a real Figma-vs-simulator pixel diff — left as-is here
    // since the follow-up correction above moves the icon instead.
    brandWordmark: {
      position: 'absolute',
      left: 45.45,
      top: 23.75,
    },
    title: {
      position: 'absolute',
      left: 34,
      top: 160,
      // Widened from 268.86: Geist renders this headline wider than the
      // system font the original width was tuned for, wrapping "Fitness
      // built around" onto two lines at the old width.
      width: 320,
      color: colors.text,
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
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: 'Geist-Regular',
    },
    cardFrame: {
      position: 'absolute',
      left: 26,
      top: 355,
    },
    // Was position:'absolute' with a fixed height:322 — emailError comes
    // straight from Supabase (error.message: unbounded, unpredictable
    // length, e.g. rate-limit messages run a full sentence), so a fixed
    // absolute gap between inputWrap and primaryButtonHit could let a long
    // message overlap the button instead of pushing it down. Flow layout
    // (minHeight preserves the visual size in the common no-error case,
    // but lets the card grow if it genuinely needs to) fixes that without
    // touching cardFrame's decorative background graphic below it.
    card: {
      position: 'absolute',
      left: 26,
      top: 355,
      width: 326,
      minHeight: 322,
      paddingTop: 21,
      paddingHorizontal: 18,
      paddingBottom: 16,
    },
    formHeading: {
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    fieldLabel: {
      marginTop: 12,
      color: colors.text,
      fontSize: 10.5,
      fontFamily: 'Geist-Regular',
    },
    inputWrap: {
      marginTop: 7,
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
      color: colors.textSecondary,
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
      marginTop: 6,
      color: '#e5484d',
      fontSize: 9,
      fontFamily: 'Geist-Regular',
    },
    // Absolutely positioned, matching every other element on this
    // pixel-coordinate canvas — sits just below the Google button
    // (top:261 + height:35), well clear of termsText's own fixed top:741.
    // Neutral tone, not error-red: this isn't something the user did
    // wrong, it's the app being honest that the button isn't wired up yet.
    socialNoticeText: {
      position: 'absolute',
      left: 19,
      top: 300,
      width: 285,
      textAlign: 'center',
      color: colors.textTertiary,
      fontSize: 10,
      lineHeight: 14,
      fontFamily: 'Geist-Medium',
    },
    // A few px taller than every other button in the app — this is one of the
    // two milestone moments (see isGlassAvailable above) that's allowed to
    // carry a little more physical weight than the standard CTA.
    primaryButtonHit: {
      marginTop: 16,
      width: 285,
      height: 44,
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
      right: 16,
      top: 7,
      transform: [{ rotate: '90deg' }],
    },
    hoverWash: {
      borderRadius: 6,
      backgroundColor: hoverWashColor,
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
      backgroundColor: colors.surfaceBorder,
    },
    dividerText: {
      color: colors.textTertiary,
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
      color: colors.text,
    },
    googleText: {
      color: colors.text,
      fontSize: 11,
      letterSpacing: 0.33,
    },
    termsText: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 741,
      color: colors.textTertiary,
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
}
