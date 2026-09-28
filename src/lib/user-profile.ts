import AsyncStorage from '@react-native-async-storage/async-storage';

import { markOnboardingComplete } from '@/lib/onboarding-draft';
import { pushProfileToRemote } from '@/lib/profile-sync';

const PROFILE_KEY = 'vervein.profile.v1';

/**
 * The subset of onboarding answers that still matter after onboarding is
 * done — this is what "the app remembers about you" once the draft (which
 * only exists during onboarding itself) is cleared. Saved once, at the
 * moment onboarding completes. AsyncStorage remains the source of truth
 * this app actually reads from everywhere; saveProfile below also
 * best-effort mirrors it to a real account-scoped row (see
 * lib/profile-sync.ts) so sign-in on a new device can restore it instead
 * of forcing onboarding again.
 */
export type UserProfile = {
  name?: string;
  email?: string;
  goal?: string;
  experience?: string;
  environment?: string;
  /** What's on hand for a home gym or minimal setup — owned-equipment.ts's
   * ids, comma-separated like `days`. undefined = never answered (the
   * setup's default list applies); 'none' = answered "none of these". Read by
   * the engine via onboarding-to-engine.ts. Device-only for now: the synced
   * profiles table has no column for it, so a new device falls back to the
   * setup's default list until it's answered again. */
  equipment?: string;
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
  /** Same health-consent-gated, optional-at-onboarding-or-later convention
   * as sex/heightCm/weightKg above — added specifically to make an honest
   * Mifflin-St Jeor maintenance-calorie estimate possible (calorie-estimate.ts's
   * estimateMaintenanceCalories), which needs age and can't substitute
   * anything else for it. Never collected before this; undefined for every
   * existing profile until filled in, same as any other optional field. */
  age?: string;
  /** Self-reported, from lib/conditions.ts's fixed list — collected only, per the Chief Architect Audit's C3 finding. Nothing in plan-preview.ts or onboarding-to-engine.ts reads this field; it exists for the user's own record and for a future validation process, not to gate exercise selection today. */
  conditions?: string[];
  /** Self-reported, from lib/movement-restrictions.ts's fixed list — unlike `conditions`, this one IS read (onboarding-to-engine.ts passes it straight through to the engine's real, already-wired movementRestrictions exclusion). `undefined` = never answered; `[]` = explicitly answered "none of these." */
  movementRestrictions?: string[];
  /** Self-reported from Settings' Ongoing Symptoms sheet, from
   * symptom-tags.ts's STANDING_SYMPTOM_TAGS — IS read: onboarding-to-engine.ts
   * passes it to the engine as standingSymptomTags, applied every day at
   * every energy level. Device-only on purpose, never synced (profile-sync.ts
   * leaves it out): the Privacy Policy promises symptom tags stay on the
   * device. `undefined` and `[]` both mean none. */
  standingSymptoms?: string[];
  /** Self-reported from Settings' Goals sheet — never derived. This app
   * deliberately doesn't model BMR/TDEE or calorie intake (see
   * calorie-estimate.ts's own doc comment), so there's no honest way to
   * compute "what your target should be." Asking directly avoids fabricating
   * a number from data (height/age/intake) this app doesn't have — undefined
   * = no goal set, same "optional, never assumed" contract as weightKg. */
  targetWeightKg?: string;
  /** Self-reported target for one exercise, from Settings' Goals sheet —
   * compared against exercise-performance.ts's own real logged
   * estimatedOneRepMax history for that exercise, never a projection or a
   * fabricated formula result. Replaces an earlier weekly calorie-burn goal
   * (removed: it mostly just re-measured session completion, dressed up in
   * kcal, and didn't fit a strength-programming app's own identity). Set
   * together or not at all — undefined = no goal set. */
  targetLiftExercise?: string;
  targetLiftWeightKg?: string;
};

export async function saveProfile(profile: UserProfile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Worst case Home falls back to generic defaults — same as a first-time user.
  }
  // Not awaited: the local save above is what every caller actually depends
  // on, and already succeeded (or didn't) by this point. The remote push is
  // a best-effort mirror on top, never a reason to slow down or fail a
  // local save that's already done.
  void pushProfileToRemote(profile);
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
 * Withdraws health-data consent: clears every health field consent covered
 * — sex, height, weight, age, health conditions, movement restrictions —
 * and the consent itself. Because saveProfile mirrors to the server, the
 * synced copy is cleared too (those columns go back to null). The Privacy
 * Policy promises consent can be withdrawn at any time; before this there
 * was no way to do it short of deleting everything. On-device logs aren't
 * touched — they never leave the device, and Delete My Data removes them.
 */
export async function withdrawHealthConsent(): Promise<UserProfile> {
  return updateProfile({
    healthConsent: 'false',
    healthConsentedAt: undefined,
    sex: undefined,
    heightCm: undefined,
    weightKg: undefined,
    age: undefined,
    conditions: undefined,
    movementRestrictions: undefined,
    standingSymptoms: undefined,
  });
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

/**
 * The shared tail of every real way onboarding finishes — verify.tsx's
 * email-OTP path, and create-account.tsx's bypass for a chain that already
 * carries a verified email (email sign-in, Apple, or Google — see
 * onboarding/index.tsx's own doc comment on the verifiedEmail route param
 * for how that rides forward). Kept as one function so every call site can't
 * drift on which fields get saved.
 */
export async function finishOnboarding(
  answers: Pick<
    UserProfile,
    | 'name'
    | 'goal'
    | 'experience'
    | 'environment'
    | 'equipment'
    | 'duration'
    | 'commitmentLevel'
    | 'days'
    | 'sex'
    | 'heightCm'
    | 'weightKg'
    | 'age'
  > & { healthConsent?: string },
  email: string
) {
  await saveProfile({
    name: answers.name,
    email,
    goal: answers.goal,
    experience: answers.experience,
    environment: answers.environment,
    // '' is a route param that never carried a list — not asked (a full
    // gym or bodyweight setup). An answered-empty list arrives as 'none'.
    equipment: answers.equipment || undefined,
    duration: answers.duration,
    commitmentLevel: answers.commitmentLevel,
    days: answers.days,
    ...withHealthConsent(answers.healthConsent === 'true' ? 'true' : 'false'),
    sex: answers.sex,
    heightCm: answers.heightCm,
    weightKg: answers.weightKg,
    age: answers.age,
  });
  await markOnboardingComplete();
}

export async function clearProfile() {
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // Best-effort — same as never having saved one.
  }
}
