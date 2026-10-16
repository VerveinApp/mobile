import * as LocalAuthentication from 'expo-local-authentication';
import type { SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from '@/components/ui/app-symbol';

import { Type } from '@/constants/theme';
import { isAppLockEnabled } from '@/lib/app-lock';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';
import { PRESSED_DIM } from '@/lib/button-interactions';

/**
 * An always-mounted overlay, not a route — the Stack underneath stays
 * mounted and keeps its navigation state while this sits on top, so
 * unlocking never dumps the user back to the first tab. Locks again on
 * every background→foreground transition, not just cold launch, which is
 * what "app lock" actually means (matches banking-app conventions).
 */
export function AppLockGate() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  // BUG FIX: this used to re-lock on any inactive→active transition — but
  // iOS also reports 'inactive' for things that never leave the app: the
  // Face ID prompt itself, Control/Notification Center, the photo picker,
  // the share sheet, every system permission alert. A successful unlock
  // came back through inactive→active and immediately re-locked, looping
  // the Face ID prompt. Only a real trip through 'background' counts now.
  const wentToBackground = useRef(false);
  // Whether App Lock is on, kept current so leaving the app can react in
  // the same tick — an awaited storage read there came too late (below).
  const lockEnabledRef = useRef(false);
  // A plain cover while the app is leaving the screen, for the app-switcher
  // snapshot (see the AppState handler).
  const [covered, setCovered] = useState(false);
  // Guards against two overlapping authenticateAsync calls (the mount-time
  // check and a foreground event landing close together, or a double-tap
  // on Try Again) stacking two system prompts.
  const isAuthenticatingRef = useRef(false);
  // "Face ID"/"Touch ID" are real Apple product names, correct only on iOS
  // hardware — settings/index.tsx's own AppLockRow label already makes this
  // same distinction. Fetched once at mount (the device's biometric type
  // doesn't change between foreground events, unlike the lock-enabled check
  // below), so there's no per-unlock-attempt flash of the generic fallback.
  const [biometricLabel, setBiometricLabel] = useState('biometrics');
  const [biometricIcon, setBiometricIcon] = useState<SFSymbol>('faceid');
  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel(Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock');
        setBiometricIcon('faceid');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
        setBiometricIcon('touchid');
      }
    })();
  }, []);

  const attemptUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // Nothing to authenticate against (simulator without enrollment, or a
        // device with no biometrics set up) — don't strand the user behind a
        // lock screen with no way through it.
        setLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock VerveIn',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        hapticSuccess();
        setLocked(false);
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
        // Cancelling is a choice, not a failure — no error buzz for it.
        hapticError();
      }
    } finally {
      isAuthenticatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = await isAppLockEnabled();
      lockEnabledRef.current = enabled;
      if (enabled) {
        setLocked(true);
        attemptUnlock();
      }
      setChecked(true);
    })();
  }, [attemptUnlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (next: AppStateStatus) => {
      // BUG FIX: nothing covered the screen on the way out, so iOS's
      // app-switcher snapshot showed whatever was open (weight, notes,
      // health history), and the lock only went up after an awaited read on
      // return, after a flash of it. Now the cover goes up as the app starts
      // leaving ('inactive' comes before the snapshot), and the lock is set
      // on 'background' itself, so return lands straight on the lock.
      if (next === 'inactive' || next === 'background') {
        if (lockEnabledRef.current) setCovered(true);
        if (next === 'background') {
          wentToBackground.current = true;
          if (lockEnabledRef.current) setLocked(true);
        }
        return;
      }
      if (next !== 'active') return;
      setCovered(false);
      // Re-read on every return: App Lock may have been switched in Settings.
      const enabled = await isAppLockEnabled();
      lockEnabledRef.current = enabled;
      if (!wentToBackground.current) return;
      wentToBackground.current = false;
      if (enabled) {
        setLocked(true);
        attemptUnlock();
      } else {
        setLocked(false);
      }
    });
    return () => subscription.remove();
  }, [attemptUnlock]);

  if (checked && !locked && covered) {
    return <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
  }
  if (!checked || !locked) return null;

  return (
    // accessibilityViewIsModal: VoiceOver stays on the lock, never on the
    // screen underneath it.
    <View style={styles.root} accessibilityViewIsModal>
      <View style={styles.iconWrap}>
        <SymbolView name={biometricIcon} size={48} tintColor="#5FBE84" />
      </View>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>VerveIn is locked</Text>
      <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>Unlock with {biometricLabel} to continue.</Text>
      <Pressable
        style={({ pressed }) => [styles.unlockButton, pressed && PRESSED_DIM]}
        onPress={attemptUnlock}
        accessibilityRole="button"
        accessibilityLabel="Try Again"
      >
        <Text style={styles.unlockButtonText} maxFontSizeMultiplier={1.15}>Try Again</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 1000,
      elevation: 1000,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(67,140,99,0.16)',
      marginBottom: 20,
    },
    title: {
      color: colors.text,
      fontSize: Type.stat,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: Type.body,
      textAlign: 'center',
      fontFamily: 'Geist-Medium',
    },
    unlockButton: {
      marginTop: 28,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#438C63',
    },
    unlockButtonText: {
      color: '#ffffff',
      fontSize: Type.body,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
