import { router, useLocalSearchParams } from 'expo-router';
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

import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { hapticError, hapticImpactLight, hapticSuccess } from '@/lib/haptics';
import { markOnboardingComplete } from '@/lib/onboarding-draft';
import { goBack } from '@/lib/onboarding-nav';
import { useFadeInEntering } from '@/lib/screen-transitions';
import { useAppColors, useAppTheme } from '@/lib/theme-context';
import { saveProfile, withHealthConsent } from '@/lib/user-profile';
import {
  ArrowUpIconGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import {
  BackArrowGraphic,
  ChevronForwardGraphic,
  PencilIconGraphic,
  ReloadIconGraphic,
} from '@/components/auth/verify-email-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;
const CARD_RADIUS = 10;

const CODE_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 30;

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VerifyEmailScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const scale = windowWidth / CANVAS_WIDTH;
  const { colors, resolvedScheme } = useAppTheme();
  // Dark mode keeps its exact original chevron gray; light mode gets its
  // own value since #E0E0E0 was tuned for a dark card, not a white one.
  const chevronColor = resolvedScheme === 'dark' ? '#E0E0E0' : '#8a8a8a';
  const isDark = resolvedScheme === 'dark';
  const cardFrameBg = isDark ? 'rgba(12,12,12,0.79)' : 'rgba(255,255,255,0.9)';
  const hairlineBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const otpBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
  const hoverWashColor = isDark ? '#ffffff' : '#000000';
  const styles = useMemo(
    () => createStyles(colors, { cardFrameBg, hairlineBorder, otpBorder, hoverWashColor }),
    [colors, cardFrameBg, hairlineBorder, otpBorder, hoverWashColor]
  );

  // All onboarding answers ride along here too (create-account forwards
  // them), even though only `email` is used on this screen — captured so
  // "back"/"change email" can return to create-account without losing them.
  const params = useLocalSearchParams<Record<string, string>>();
  const displayEmail = params.email || 'you@example.com';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const isCodeIncomplete = digits.join('').length < CODE_LENGTH;

  const entering = useFadeInEntering();
  const resendHover = useHoverFade();
  const resendPress = useLiquidPress();
  const changeEmailHover = useHoverFade();
  const changeEmailPress = useLiquidPress();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');

    // A paste (or autofill) delivers the whole code into one box at once —
    // distribute it across the remaining boxes instead of only keeping the
    // last character like a normal keystroke would.
    if (digitsOnly.length > 1) {
      setDigits((prev) => {
        const next = [...prev];
        let cursor = index;
        for (const char of digitsOnly) {
          if (cursor >= CODE_LENGTH) break;
          next[cursor] = char;
          cursor += 1;
        }
        return next;
      });
      if (codeError) setCodeError(null);
      const lastFilled = Math.min(index + digitsOnly.length, CODE_LENGTH) - 1;
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    const clean = digitsOnly.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (codeError) setCodeError(null);
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleContinue = async () => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setCodeError('Enter the full 4-digit code.');
      hapticError();
      return;
    }
    setCodeError(null);
    hapticSuccess();
    // Onboarding is fully complete once email verification succeeds — this
    // was the last step in the flow, not a launch point back into it. The
    // draft itself gets cleared right after, so the parts of it Home still
    // needs (experience/duration/commitment/days) are copied into a small
    // durable profile first — see lib/user-profile.ts.
    // Both writes are awaited before navigating on — all-set/trajectory
    // read the profile again a couple screens later, and there's no reason
    // to leave that read racing this write when awaiting costs nothing
    // visible (see the same fix in onboarding/create-account.tsx, where
    // skipping the await was a real bug).
    await saveProfile({
      name: params.name,
      email: params.email,
      goal: params.goal,
      experience: params.experience,
      environment: params.environment,
      duration: params.duration,
      commitmentLevel: params.commitmentLevel,
      days: params.days,
      ...withHealthConsent(params.healthConsent === 'true' ? 'true' : 'false'),
      sex: params.sex,
      heightCm: params.heightCm,
      weightKg: params.weightKg,
    });
    await markOnboardingComplete();
    router.replace('/onboarding/all-set' as never);
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    hapticImpactLight();
    setCooldown(RESEND_COOLDOWN_SECONDS);
    // TODO: trigger the actual resend-code request once the backend is wired up.
  };

  const handleChangeEmail = () => {
    goBack('/onboarding/create-account', params);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>

        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/onboarding/create-account', params)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackArrowGraphic color={colors.text} />
        </Pressable>

        <View style={styles.brandBlock} pointerEvents="none">
          <View style={styles.brandAccent}>
            <LogoMarkAccentGraphic color={colors.text} />
          </View>
          <View style={styles.brandMark}>
            <LogoMarkGraphic color={colors.text} />
          </View>
          <Text style={styles.brandText} maxFontSizeMultiplier={1.1}>ervein</Text>
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Almost there</Text>

        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          Enter the 4-digit code sent to{' '}
          <Text style={styles.subtitleEmail}>{displayEmail}</Text>
        </Text>

        <View style={styles.cardFrame} pointerEvents="none">
          <View style={styles.cardSheen} />
        </View>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <View key={index} style={[styles.otpBox, focusedIndex === index && styles.otpBoxFocused]}>
              <View pointerEvents="none" style={styles.otpBoxSheen} />
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
                keyboardType="number-pad"
                autoFocus={index === 0}
                maxLength={1}
                textAlign="center"
                returnKeyType={index === CODE_LENGTH - 1 ? 'done' : 'next'}
                onSubmitEditing={index === CODE_LENGTH - 1 ? handleContinue : undefined}
              />
            </View>
          ))}
        </View>

        {codeError ? (
          <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.codeErrorText} maxFontSizeMultiplier={1.3}>
            {codeError}
          </ReanimatedAnimated.Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, isCodeIncomplete && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={isCodeIncomplete}
        >
          <Text style={styles.primaryText} maxFontSizeMultiplier={1.15}>Continue</Text>
          <View style={styles.buttonArrow}>
            <ArrowUpIconGraphic size={24} />
          </View>
        </Pressable>

        <View style={styles.resendCardContent}>
          <Pressable
            style={styles.resendRowHit}
            onPress={handleResend}
            disabled={cooldown > 0}
            onHoverIn={resendHover.onHoverIn}
            onHoverOut={resendHover.onHoverOut}
            onPressIn={resendPress.onPressIn}
            onPressOut={resendPress.onPressOut}
          >
            <Animated.View style={[styles.resendRow, { transform: [{ scale: resendPress.scale }] }]}>
              <View pointerEvents="none" style={styles.rowSheen} />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.rowWash,
                  { opacity: resendHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }) },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.rowWash,
                  { opacity: resendPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }) },
                ]}
              />
              <View style={styles.resendIcon}>
                <ReloadIconGraphic color={cooldown > 0 ? '#4a4a4a' : '#29563A'} />
              </View>
              <Text
                style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}
                maxFontSizeMultiplier={1.2}
              >
                Resend your email
              </Text>
              <Text style={styles.countdownText} maxFontSizeMultiplier={1.15}>{formatCountdown(cooldown)}</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.changeEmailRowHit}
            onPress={handleChangeEmail}
            onHoverIn={changeEmailHover.onHoverIn}
            onHoverOut={changeEmailHover.onHoverOut}
            onPressIn={changeEmailPress.onPressIn}
            onPressOut={changeEmailPress.onPressOut}
          >
            <Animated.View style={[styles.changeEmailRow, { transform: [{ scale: changeEmailPress.scale }] }]}>
              <View pointerEvents="none" style={styles.rowSheen} />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.rowWash,
                  { opacity: changeEmailHover.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }) },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.rowWash,
                  { opacity: changeEmailPress.glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }) },
                ]}
              />
              <View style={styles.resendIcon}>
                <PencilIconGraphic />
              </View>
              <Text style={styles.resendText} maxFontSizeMultiplier={1.2}>Change your email address</Text>
              <View style={styles.chevronIcon}>
                <ChevronForwardGraphic color={chevronColor} />
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </ReanimatedAnimated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppColors>,
  screenColors: { cardFrameBg: string; hairlineBorder: string; otpBorder: string; hoverWashColor: string }
) {
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
    fadeLayer: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
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
      left: 32,
      top: 93,
      width: 146,
      height: 44,
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
    brandText: {
      position: 'absolute',
      left: 32.82,
      top: 10.17,
      color: colors.text,
      fontSize: 29.795,
      fontFamily: 'Geist-Medium',
    },
    title: {
      position: 'absolute',
      left: 32,
      top: 164,
      width: 146,
      color: colors.text,
      fontSize: 22.957,
      lineHeight: 28,
      fontFamily: 'Geist-SemiBold',
    },
    subtitle: {
      position: 'absolute',
      left: 33,
      top: 206,
      width: 202,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: 'Geist-Medium',
    },
    subtitleEmail: {
      color: '#438C63',
    },
    cardFrame: {
      position: 'absolute',
      left: 25,
      top: 345,
      width: 326,
      height: 340,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: screenColors.hairlineBorder,
      backgroundColor: screenColors.cardFrameBg,
      overflow: 'hidden',
    },
    // A static, subtle top-edge highlight — same treatment as every other
    // card surface redesigned this pass (selectable-cards.tsx, Days).
    cardSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '48%',
      backgroundColor: colors.surfaceSheen,
    },
    otpRow: {
      position: 'absolute',
      left: 65,
      top: 369,
      width: 244,
      height: 73,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    otpBox: {
      width: 53,
      height: 73,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: screenColors.otpBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    otpBoxSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '40%',
      backgroundColor: colors.surfaceSheen,
    },
    otpBoxFocused: {
      borderColor: '#438C63',
    },
    otpInput: {
      width: '100%',
      height: '100%',
      color: colors.text,
      fontSize: 28,
      fontFamily: 'Geist-SemiBold',
      padding: 0,
    },
    codeErrorText: {
      position: 'absolute',
      left: 65,
      top: 446,
      color: '#e5484d',
      fontSize: 9,
      fontFamily: 'Geist-Regular',
    },
    primaryButton: {
      position: 'absolute',
      left: 46,
      top: 485,
      width: 285,
      height: 38,
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
      // No fontWeight here — Geist-SemiBold is a single static-weight font
      // file, so layering a numeric weight on top risks iOS synthetic-bolding
      // it further instead of just rendering the weight the file already is.
      fontFamily: 'Geist-SemiBold',
    },
    buttonArrow: {
      position: 'absolute',
      right: 17,
      top: 6,
      transform: [{ rotate: '90deg' }],
    },
    // Two fully independent rows (own border + background each), not one
    // shared static card sitting behind unrelated animated content — that
    // meant pressing a row scaled its text/icon while the box around it
    // stayed completely still. Same stacked-list concept, just each row now
    // carries its own box so the press animation moves something real.
    resendCardContent: {
      position: 'absolute',
      left: 47,
      top: 559,
      width: 285,
      height: 76,
    },
    resendRowHit: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 285,
      height: 33,
    },
    resendRow: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: screenColors.hairlineBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    changeEmailRowHit: {
      position: 'absolute',
      left: 0,
      top: 43,
      width: 285,
      height: 33,
    },
    changeEmailRow: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: screenColors.hairlineBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    rowSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '48%',
      backgroundColor: colors.surfaceSheen,
    },
    rowWash: {
      backgroundColor: screenColors.hoverWashColor,
      zIndex: -1,
    },
    resendIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resendText: {
      flex: 1,
      marginLeft: 13,
      color: colors.text,
      fontSize: 10,
      fontFamily: 'Geist-Medium',
    },
    resendTextDisabled: {
      color: colors.textSecondary,
    },
    countdownText: {
      color: 'rgba(144,144,144,0.7)',
      fontSize: 10,
      fontFamily: 'Geist-Medium',
    },
    chevronIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
