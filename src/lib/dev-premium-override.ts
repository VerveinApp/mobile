import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ TEMPORARY DEV-ONLY BACKDOOR — REMOVE BEFORE THE REAL APP STORE
// SUBMISSION, same reminder as the privacy policy check (both flagged
// together per the user's own request). Lets whoever knows UNLOCK_KEY force
// full VerveIn Plus locally, entirely client-side — never touches
// RevenueCat/App Store, so it can't grant or fake a real purchase, but it
// DOES bypass every paywalled screen in the app for anyone who has this
// string. Fine for one developer's own device during beta testing; not
// something that should ship. Delete this file and the two call sites that
// reference it (purchases.ts's hasPremiumEntitlement, settings/index.tsx's
// own Developer section) when it's time to remove it — searching the repo
// for DEV_PREMIUM is the fastest way to find every reference.
const UNLOCK_KEY = '5f$fmkd%23vh';
const UNLOCKED_STORAGE_KEY = 'vervein.devPremiumUnlocked.v1';
const OVERRIDE_STORAGE_KEY = 'vervein.devPremiumOverride.v1';

export function checkDevPremiumUnlockKey(candidate: string): boolean {
  return candidate.trim() === UNLOCK_KEY;
}

/** Whether the correct key has ever been entered on this device — persisted
 * so the toggle stays reachable without retyping the key every visit. */
export async function isDevPremiumUnlocked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(UNLOCKED_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDevPremiumUnlocked(): Promise<void> {
  try {
    await AsyncStorage.setItem(UNLOCKED_STORAGE_KEY, 'true');
  } catch {
    // Worst case the key has to be re-entered next time — not a crash.
  }
}

/** The actual on/off switch, only reachable once unlocked. Read by
 * purchases.ts's hasPremiumEntitlement — see that function's own comment. */
export async function getDevPremiumOverride(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OVERRIDE_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDevPremiumOverride(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(OVERRIDE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Worst case the toggle doesn't stick — not a crash.
  }
}
