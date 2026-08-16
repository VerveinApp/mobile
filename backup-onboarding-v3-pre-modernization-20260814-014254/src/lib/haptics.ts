import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin, silent-by-default haptics wrapper. Web has no haptics API, and a rare
 * hardware/permission failure shouldn't ever crash a tap handler — both cases
 * just no-op.
 */

/** For picking one option from a set (e.g. a goal card) — iOS's own "selection changed" feel. */
export function hapticSelect() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/** For a primary confirming action (Continue, Apple/Google sign-in). */
export function hapticImpactLight() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** For a validation error (bad email, incomplete code, empty required field). */
export function hapticError() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** For a completed milestone (email verified, onboarding finished) — iOS's own "success" feel. */
export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
