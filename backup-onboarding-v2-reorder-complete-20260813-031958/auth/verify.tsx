import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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

import { hapticError, hapticImpactLight } from '@/lib/haptics';
import { markOnboardingComplete } from '@/lib/onboarding-draft';
import { useFadeInEntering } from '@/lib/screen-transitions';
import {
  ArrowUpIconGraphic,
  GlowGraphic,
  LogoMarkAccentGraphic,
  LogoMarkGraphic,
} from '@/components/auth/create-account-graphics';
import {
  BackArrowGraphic,
  ChevronForwardGraphic,
  PencilIconGraphic,
  ReloadIconGraphic,
  ResendCardGraphic,
  VerifyCardGraphic,
} from '@/components/auth/verify-email-graphics';

const CANVAS_WIDTH = 375;
const CANVAS_HEIGHT = 812;

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

  const { email } = useLocalSearchParams<{ email?: string }>();
  const displayEmail = email || 'you@example.com';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const isCodeIncomplete = digits.join('').length < CODE_LENGTH;

  const entering = useFadeInEntering();

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

  const handleContinue = () => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setCodeError('Enter the full 4-digit code.');
      hapticError();
      return;
    }
    setCodeError(null);
    hapticImpactLight();
    // Onboarding is fully complete once email verification succeeds — this
    // was the last step in the flow, not a launch point back into it.
    markOnboardingComplete();
    router.replace('/(tabs)' as never);
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    hapticImpactLight();
    setCooldown(RESEND_COOLDOWN_SECONDS);
    // TODO: trigger the actual resend-code request once the backend is wired up.
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
      <ReanimatedAnimated.View style={styles.fadeLayer} entering={entering}>
        <View style={styles.glow} pointerEvents="none">
          <GlowGraphic />
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <BackArrowGraphic />
        </Pressable>

        <View style={styles.brandBlock} pointerEvents="none">
          <View style={styles.brandAccent}>
            <LogoMarkAccentGraphic />
          </View>
          <View style={styles.brandMark}>
            <LogoMarkGraphic />
          </View>
          <Text style={styles.brandText}>ervein</Text>
        </View>

        <Text style={styles.title}>Almost there</Text>

        <Text style={styles.subtitle}>
          Enter the 4-digit code sent to{' '}
          <Text style={styles.subtitleEmail}>{displayEmail}</Text>
        </Text>

        <View style={styles.cardFrame} pointerEvents="none">
          <VerifyCardGraphic />
        </View>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <View key={index} style={[styles.otpBox, focusedIndex === index && styles.otpBoxFocused]}>
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
          <ReanimatedAnimated.Text entering={FadeIn.duration(150)} style={styles.codeErrorText}>
            {codeError}
          </ReanimatedAnimated.Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, isCodeIncomplete && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={isCodeIncomplete}
        >
          <Text style={styles.primaryText}>Continue</Text>
          <View style={styles.buttonArrow}>
            <ArrowUpIconGraphic size={24} />
          </View>
        </Pressable>

        <View style={styles.resendCard} pointerEvents="none">
          <ResendCardGraphic />
        </View>

        <View style={styles.resendCardContent}>
          <Pressable style={styles.resendRow} onPress={handleResend} disabled={cooldown > 0}>
            <View style={styles.resendIcon}>
              <ReloadIconGraphic />
            </View>
            <Text style={styles.resendText}>Resend your email</Text>
            <Text style={styles.countdownText}>{formatCountdown(cooldown)}</Text>
          </Pressable>

          <View style={styles.resendDivider} />

          <Pressable style={styles.changeEmailRow} onPress={handleChangeEmail}>
            <View style={styles.resendIcon}>
              <PencilIconGraphic />
            </View>
            <Text style={styles.resendText}>Change your email address</Text>
            <View style={styles.chevronIcon}>
              <ChevronForwardGraphic />
            </View>
          </Pressable>
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
    color: '#ffffff',
    fontSize: 29.795,
    fontWeight: '500',
    fontFamily: 'System',
  },
  title: {
    position: 'absolute',
    left: 32,
    top: 164,
    width: 146,
    color: '#ffffff',
    fontSize: 22.957,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: 'System',
  },
  subtitle: {
    position: 'absolute',
    left: 33,
    top: 206,
    width: 202,
    color: '#b0b0b0',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'System',
  },
  subtitleEmail: {
    color: '#438C63',
  },
  cardFrame: {
    position: 'absolute',
    left: 25,
    top: 345,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#676767',
    backgroundColor: '#090909',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFocused: {
    borderColor: '#438C63',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'System',
    padding: 0,
  },
  codeErrorText: {
    position: 'absolute',
    left: 65,
    top: 446,
    color: '#e5484d',
    fontSize: 9,
    fontWeight: '400',
    fontFamily: 'System',
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
    fontWeight: '500',
    fontFamily: 'System',
  },
  buttonArrow: {
    position: 'absolute',
    right: 17,
    top: 6,
    transform: [{ rotate: '90deg' }],
  },
  resendCard: {
    position: 'absolute',
    left: 47,
    top: 559,
  },
  resendCardContent: {
    position: 'absolute',
    left: 47,
    top: 559,
    width: 285,
    height: 70,
  },
  resendRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 285,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  changeEmailRow: {
    position: 'absolute',
    left: 0,
    top: 36,
    width: 285,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  resendDivider: {
    position: 'absolute',
    left: 0,
    top: 36,
    width: 285,
    height: 1,
    backgroundColor: '#BDBDBD',
    opacity: 0.3,
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'System',
  },
  countdownText: {
    color: 'rgba(144,144,144,0.7)',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'System',
  },
  chevronIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
