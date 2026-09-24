import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildBackupPayload, clearAllLocalData, parseBackupPayload, restoreBackupPayload } from '@/lib/data-backup';
import { getAccountStartDate, hasCompletedOnboarding, restoreOnboardingCompleted } from '@/lib/onboarding-draft';
import { restoreStashedProgressPhotos, stashProgressPhotos } from '@/lib/progress-photos';

/**
 * Which account the training data on this device belongs to.
 *
 * BUG FIX this module exists for: nearly everything in VerveIn is local-only
 * (workouts, logs, notes, photos — see data-backup.ts), and Sign Out
 * deliberately keeps it so signing back in loses nothing. But nothing
 * recorded WHOSE it was. When a different account signed in on the same
 * phone, auth/verify.tsx saw "onboarding complete" and dropped them straight
 * into the previous person's history — and the next profile save uploaded
 * that person's health profile (sex, weight, conditions) into the new
 * account's server row.
 *
 * Now, when a different account signs in, the current data is set aside
 * under its owner's id (never shown to the new account, never deleted) and
 * the new account starts from its own set-aside data if it has used this
 * device before, or from a clean slate otherwise.
 */
const OWNER_KEY = 'vervein.localDataOwner.v1';

function stashKey(userId: string): string {
  return `vervein.accountStash.${userId}.v1`;
}

type AccountStash = {
  payload: unknown;
  onboarded: boolean;
  accountStartDate: string | null;
};

export type AccountSwitchResult = 'same-account' | 'restored' | 'fresh';

/**
 * Call right after a successful sign-in, BEFORE anything reads or writes the
 * local profile — auth/verify.tsx (email code) and create-account.tsx
 * (Apple/Google) both do.
 */
export async function prepareLocalDataForAccount(userId: string): Promise<AccountSwitchResult> {
  let owner: string | null;
  try {
    owner = await AsyncStorage.getItem(OWNER_KEY);
  } catch {
    return 'same-account';
  }
  if (owner === userId) return 'same-account';
  if (owner === null) {
    // Nothing recorded yet: a first sign-in, or an install from before this
    // module existed. Either way the only account that can have produced
    // what's here is the one signing in now.
    await AsyncStorage.setItem(OWNER_KEY, userId);
    return 'same-account';
  }

  const stash: AccountStash = {
    payload: await buildBackupPayload(),
    onboarded: await hasCompletedOnboarding(),
    accountStartDate: await getAccountStartDate(),
  };
  await AsyncStorage.setItem(stashKey(owner), JSON.stringify(stash));
  await stashProgressPhotos(owner);
  await clearAllLocalData();
  await AsyncStorage.setItem(OWNER_KEY, userId);

  const raw = await AsyncStorage.getItem(stashKey(userId));
  if (!raw) return 'fresh';
  try {
    const own = JSON.parse(raw) as AccountStash;
    // Same validation an imported backup gets — if a later app version
    // changed the backup format, the stash is left in place untouched
    // rather than half-restored.
    const parsed = parseBackupPayload(JSON.stringify(own.payload));
    if (!parsed.ok) return 'fresh';
    await restoreBackupPayload(parsed.payload);
    await restoreStashedProgressPhotos(userId);
    if (own.onboarded) await restoreOnboardingCompleted(own.accountStartDate);
    await AsyncStorage.removeItem(stashKey(userId));
    return 'restored';
  } catch {
    return 'fresh';
  }
}

/**
 * For installs from before this module existed. Their data has no recorded
 * owner until the next sign-in, and someone who stays signed in never signs
 * in again, so if they later signed out and a different account signed in,
 * that account would still be handed their data. Called at launch with the
 * restored session's account: it becomes the owner only if nobody is
 * recorded yet, and an owner that's already recorded is never overwritten.
 */
export async function claimLocalDataIfUnowned(userId: string): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(OWNER_KEY)) === null) await AsyncStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Unrecorded is the state it was already in; the next sign-in records it.
  }
}

/** After Delete Account: the data is gone and so is the account, so this
 * device's data no longer belongs to anyone. */
export async function forgetLocalDataOwner(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OWNER_KEY);
  } catch {
    // Harmless if it lingers — the next sign-in just finds nothing to set aside.
  }
}
