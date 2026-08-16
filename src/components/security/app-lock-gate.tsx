import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { isAppLockEnabled } from '@/lib/app-lock';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useAppColors } from '@/lib/theme-context';

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
  const appState = useRef(AppState.currentState);

  const attemptUnlock = useCallback(async () => {
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
      promptMessage: 'Unlock Vervein',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      hapticSuccess();
      setLocked(false);
    } else {
      hapticError();
    }
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = await isAppLockEnabled();
      if (enabled) {
        setLocked(true);
        attemptUnlock();
      }
      setChecked(true);
    })();
  }, [attemptUnlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const cameToForeground = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (!cameToForeground) return;
      const enabled = await isAppLockEnabled();
      if (enabled) {
        setLocked(true);
        attemptUnlock();
      }
    });
    return () => subscription.remove();
  }, [attemptUnlock]);

  if (!checked || !locked) return null;

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <SymbolView name="faceid" size={48} tintColor="#5FBE84" />
      </View>
      <Text style={styles.title}>Vervein is locked</Text>
      <Text style={styles.subtitle}>Unlock with Face ID to continue.</Text>
      <Pressable style={styles.unlockButton} onPress={attemptUnlock}>
        <Text style={styles.unlockButtonText}>Try Again</Text>
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
      fontSize: 18,
      letterSpacing: -0.2,
      fontFamily: 'Geist-Bold',
    },
    subtitle: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 13,
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
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
  });
}
