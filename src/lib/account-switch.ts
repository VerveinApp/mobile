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
// Written once the outgoing account's data is safely set aside and removed
// when the switch has finished. Still there on the next sign-in means the
// app was killed mid-switch — see finishInterruptedSwitch.
const SWITCH_PENDING_KEY = 'vervein.accountSwitchPending.v1';

// Small per-person states that aren't training data (so not in a backup)
// but belong to one person, not the phone: where they are with the Plus
// offer and the one-time prompts, when they last saw a coaching note, and
// whether THEY chose to connect Apple Health. A second account on the same
// phone used to inherit all of these — including a Health connection the
// phone's owner made, feeding the owner's Health data into someone else's
// plan. They travel with the account now: set aside, cleared, and restored.
const PER_PERSON_KEYS = [
  'vervein.paywallCheckinCount.v1',
  'vervein.paywallShown.v1',
  'vervein.reminderPromptOffered.v1',
  'vervein.coachingInsight.lastShown.v1',
  'vervein.planFit.lastShown.v1',
  'vervein.equipmentPromptDismissed.v1',
  'vervein.healthKitConnected.v1',
  'vervein.healthKitBannerDismissed.v1',
] as const;

function stashKey(userId: string): string {
  return `vervein.accountStash.${userId}.v1`;
}

type AccountStash = {
  payload: unknown;
  onboarded: boolean;
  accountStartDate: string | null;
  /** PER_PERSON_KEYS' values (absent in stashes made before they were). */
  flags?: Record<string, string | null>;
};

async function readFlags(): Promise<Record<string, string | null>> {
  const pairs = await AsyncStorage.multiGet([...PER_PERSON_KEYS]);
  return Object.fromEntries(pairs);
}

async function clearFlags(): Promise<void> {
  await AsyncStorage.multiRemove([...PER_PERSON_KEYS]);
}

async function restoreFlags(flags: Record<string, string | null> | undefined): Promise<void> {
  const present = Object.entries(flags ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== null && (PER_PERSON_KEYS as readonly string[]).includes(entry[0])
  );
  if (present.length > 0) await AsyncStorage.multiSet(present);
}

/** A device with nothing on it — what's left after a switch was cut off
 * between clearing and finishing. Setting THAT aside would overwrite the
 * real data its owner already has set aside. */
function isEmptyPayload(payload: Awaited<ReturnType<typeof buildBackupPayload>>): boolean {
  return (
    payload.profile === null &&
    payload.sessionHistory.length === 0 &&
    payload.workoutLog.length === 0 &&
    payload.notes.length === 0 &&
    payload.weightLog.length === 0
  );
}

/**
 * BUG FIX: if the app was killed after the outgoing account's data was set
 * aside and cleared, but before the new owner was recorded, the next sign-in
 * set the now-empty device aside under the OLD owner, overwriting their real
 * stash. The marker says a switch to `to` was underway: its first half (the
 * stash) is done, so finish the rest — clear what's left, record `to` as
 * the owner, bring back `to`'s own data — before handling this sign-in.
 */
async function finishInterruptedSwitch(): Promise<void> {
  const raw = await AsyncStorage.getItem(SWITCH_PENDING_KEY);
  if (!raw) return;
  const pending = JSON.parse(raw) as { from: string; to: string };
  await clearAllLocalData();
  await clearFlags();
  await AsyncStorage.setItem(OWNER_KEY, pending.to);
  await restoreOwnStash(pending.to);
  await AsyncStorage.removeItem(SWITCH_PENDING_KEY);
}

/** Brings an account's set-aside data back onto the (already cleared)
 * device. 'fresh' when it has nothing set aside, or the stash can't be read
 * by this app version (it's then left in place, untouched). */
async function restoreOwnStash(userId: string): Promise<AccountSwitchResult> {
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
    await restoreFlags(own.flags);
    if (own.onboarded) await restoreOnboardingCompleted(own.accountStartDate);
    await AsyncStorage.removeItem(stashKey(userId));
    return 'restored';
  } catch {
    return 'fresh';
  }
}

export type AccountSwitchResult = 'same-account' | 'restored' | 'fresh';

/**
 * Call right after a successful sign-in, BEFORE anything reads or writes the
 * local profile — auth/verify.tsx (email code) and create-account.tsx
 * (Apple/Google) both do.
 */
export async function prepareLocalDataForAccount(userId: string): Promise<AccountSwitchResult> {
  let owner: string | null;
  try {
    await finishInterruptedSwitch();
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

  const payload = await buildBackupPayload();
  // Never overwrite someone's real set-aside data with an empty device.
  const existingStash = await AsyncStorage.getItem(stashKey(owner));
  if (!(existingStash && isEmptyPayload(payload))) {
    const stash: AccountStash = {
      payload,
      onboarded: await hasCompletedOnboarding(),
      accountStartDate: await getAccountStartDate(),
      flags: await readFlags(),
    };
    await AsyncStorage.setItem(stashKey(owner), JSON.stringify(stash));
    await stashProgressPhotos(owner);
  }
  await AsyncStorage.setItem(SWITCH_PENDING_KEY, JSON.stringify({ from: owner, to: userId }));
  await clearAllLocalData();
  await clearFlags();
  await AsyncStorage.setItem(OWNER_KEY, userId);
  const result = await restoreOwnStash(userId);
  await AsyncStorage.removeItem(SWITCH_PENDING_KEY);
  return result;
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

/**
 * At launch, with the restored session's account. BUG FIX: sign-in stores
 * the new session before prepareLocalDataForAccount runs, so an app killed
 * in between — or partway through a switch — relaunched signed in as the
 * new account over the previous person's data, and nothing finished the
 * switch until a sign-in that never came. This finishes it: an interrupted
 * switch is completed, and data owned by someone other than the signed-in
 * account is set aside for its owner. Returns true when the device's data
 * changed under the screens already showing, so the caller can reload.
 */
export async function reconcileLocalDataOwner(userId: string): Promise<boolean> {
  try {
    const [owner, pending] = await Promise.all([
      AsyncStorage.getItem(OWNER_KEY),
      AsyncStorage.getItem(SWITCH_PENDING_KEY),
    ]);
    if (!pending && owner === null) {
      await AsyncStorage.setItem(OWNER_KEY, userId);
      return false;
    }
    if (!pending && owner === userId) return false;
    await prepareLocalDataForAccount(userId);
    return true;
  } catch {
    // Retried on the next launch; the next sign-in also reconciles.
    return false;
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
