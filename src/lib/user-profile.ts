import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'vervein.profile.v1';

/**
 * The subset of onboarding answers that still matter after onboarding is
 * done — there's no backend/account profile yet, so this is what "the app
 * remembers about you" once the draft (which only exists during onboarding
 * itself) is cleared. Saved once, at the moment onboarding completes.
 */
export type UserProfile = {
  name?: string;
  email?: string;
  goal?: string;
  experience?: string;
  environment?: string;
  duration?: string;
  commitmentLevel?: string;
  /** Comma-separated lowercase weekday names, e.g. "tuesday,friday,sunday". */
  days?: string;
  /** Everything below is optional health data — only present if the user
   * consented during onboarding (healthConsent === 'true'), or filled it in
   * later from Settings. */
  healthConsent?: string;
  /** ISO 8601 timestamp of the moment healthConsent was last set to 'true' —
   * an auditable consent record, not just a boolean, per Washington's My
   * Health My Data Act (opt-in consent must be a real, provable event before
   * health data is collected — a bare flag with no "when" isn't that).
   * Never set directly; saveHealthConsent() below owns writing it. */
  healthConsentedAt?: string;
  sex?: string;
  heightCm?: string;
  weightKg?: string;
  /** Self-reported, from lib/conditions.ts's fixed list — collected only, per the Chief Architect Audit's C3 finding. Nothing in plan-preview.ts or onboarding-to-engine.ts reads this field; it exists for the user's own record and for a future validation process, not to gate exercise selection today. */
  conditions?: string[];
};

export async function saveProfile(profile: UserProfile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Worst case Home falls back to generic defaults — same as a first-time user.
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

/** Read-modify-write for Settings' edit screens — merges over whatever's
 * already saved rather than requiring every field on every call. */
export async function updateProfile(partial: UserProfile): Promise<UserProfile> {
  const current = (await getProfile()) ?? {};
  const next = { ...current, ...partial };
  await saveProfile(next);
  return next;
}

/**
 * The one place healthConsent gets set — stamps healthConsentedAt with the
 * real moment consent was given whenever it's 'true'. Never call
 * saveProfile/updateProfile with a bare `healthConsent: 'true'` directly;
 * spread this in instead, so the timestamp can't be forgotten at a call site.
 */
export function withHealthConsent(consent: 'true' | 'false'): Pick<UserProfile, 'healthConsent' | 'healthConsentedAt'> {
  return consent === 'true'
    ? { healthConsent: 'true', healthConsentedAt: new Date().toISOString() }
    : { healthConsent: 'false' };
}

export async function clearProfile() {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // Best-effort — same as never having saved one.
  }
}
