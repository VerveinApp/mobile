import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin, silent-by-default haptics wrapper. Web has no haptics API, and a rare
 * hardware/permission failure shouldn't ever crash a tap handler — both cases
 * just no-op.
 */

const ENABLED_KEY = 'vervein.hapticsEnabled.v1';

// Trigger functions below fire synchronously from UI event handlers, so the
// on/off check has to be synchronous too — this in-memory flag is the
// source of truth at call time, hydrated once from storage on load and kept
// current by setHapticsEnabled (Settings' toggle updates it immediately,
// not just on next launch).
let hapticsEnabled = true;

AsyncStorage.getItem(ENABLED_KEY)
  .then((raw) => {
    if (raw === 'false') hapticsEnabled = false;
  })
  .catch(() => {});

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export async function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
  try {
    await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    // Worst case the preference doesn't survive a relaunch — same as leaving it at default.
  }
}

/** For picking one option from a set (e.g. a goal card) — iOS's own "selection changed" feel. */
export function hapticSelect() {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** For a primary confirming action (Continue, Apple/Google sign-in). */
export function hapticImpactLight() {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** For a validation error (bad email, incomplete code, empty required field). */
export function hapticError() {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** For a completed milestone (email verified, onboarding finished) — iOS's own "success" feel. */
export function hapticSuccess() {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** For landing on a meaningfully low/concerning value (e.g. an "Empty" energy check-in) — a gentler, acknowledging cue, not a celebratory one. */
export function hapticWarning() {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
