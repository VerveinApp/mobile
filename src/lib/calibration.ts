import AsyncStorage from '@react-native-async-storage/async-storage';

import { computeUpdatedCalibration, DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import type { FeedbackResponse, UserCalibration } from '@/lib/engine/types';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';

const KEY = 'vervein.calibration.v1';

/** The one learned, per-user variable in the app — a multiplier clamped to [0.5, 1.4], nudged by post-session feedback (see M15's real math in engine/personal-calibration.ts). Defaults to a neutral 1.0× until the user has given any feedback. */
export async function getCalibration(): Promise<UserCalibration> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };
    return JSON.parse(raw) as UserCalibration;
  } catch {
    return { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };
  }
}

/** Records one post-session feedback response and returns the updated calibration — the app-side equivalent of M14 (Feedback Intake) handing straight to M15, without M17's workoutId/duplicate-feedback machinery this app has no use for (no workouts table; a session either got a feedback tap or it didn't). */
export async function submitSessionFeedback(feedback: FeedbackResponse): Promise<UserCalibration> {
  const current = await getCalibration();
  const updated = computeUpdatedCalibration(current, feedback);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Worst case this feedback doesn't stick — next session just reads the prior calibration, same as never having submitted it.
  }
  return updated;
}

/** Overwrites calibration wholesale — the data-backup.ts restore path's one
 * legitimate reason to bypass computeUpdatedCalibration's normal nudge-only
 * math and write a previously-exported value directly. Never call this from
 * anywhere else; every other caller should go through submitSessionFeedback
 * so the learned multiplier only ever moves via real feedback. */
export async function restoreCalibration(calibration: UserCalibration): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(calibration));
  } catch {
    // Worst case this one field doesn't restore — the rest of the backup still applies independently.
  }
}

/** DISCLOSED FIX: this store is backed up by buildBackupPayload but had no
 * clear function at all, so it was silently missing from
 * clearAllLocalData's "every real local store" clear-list (data-backup.ts) —
 * a "Delete My Data"/"Delete Account" run left the learned multiplier fully
 * intact, contradicting the whole point of a full wipe. */
export async function clearCalibration(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having submitted any feedback.
  }
}
