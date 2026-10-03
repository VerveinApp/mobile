import type { UserProfile } from '@/lib/user-profile';

/**
 * The `profiles` row for this profile — exactly what reaches the server.
 * Kept separate from the upload itself so the consent rule below is tested
 * directly (see __tests__/privacy-promises.test.ts).
 */
export function remoteProfileRow(profile: UserProfile, userId: string) {
  // Health fields reach the server only with consent — the Privacy
  // Policy's promise (Sections 2 and 10), enforced here, in the one place
  // every profile save passes through, rather than at each screen that can
  // edit them: Weight History, Health Conditions and Movement Restrictions
  // all write to the profile without asking, and used to sync whatever
  // they wrote. Without consent they go up as null — they still work on
  // this device — which also clears anything an earlier build synced.
  const consented = profile.healthConsent === 'true';
  const ifConsented = <T>(value: T | undefined): T | null => (consented ? (value ?? null) : null);
  return {
    user_id: userId,
    name: profile.name ?? null,
    goal: profile.goal ?? null,
    experience: profile.experience ?? null,
    environment: profile.environment ?? null,
    equipment: profile.equipment ?? null,
    duration: profile.duration ?? null,
    commitment_level: profile.commitmentLevel ?? null,
    days: profile.days ?? null,
    health_consent: profile.healthConsent ?? null,
    health_consented_at: profile.healthConsentedAt ?? null,
    sex: ifConsented(profile.sex),
    height_cm: ifConsented(profile.heightCm),
    weight_kg: ifConsented(profile.weightKg),
    conditions: ifConsented(profile.conditions),
    movement_restrictions: ifConsented(profile.movementRestrictions),
    // BUG FIX (found in a later full-app audit): these were added to
    // UserProfile for the Goals feature but never wired into either sync
    // direction here, so a target weight or lift target set locally
    // silently never reached a new device or a post-reinstall restore —
    // see 20260907000000_profile_goals_fields.sql and
    // 20260909000000_profile_target_lift_fields.sql for the matching
    // column migrations this needs deployed to actually work.
    age: ifConsented(profile.age),
    target_weight_kg: profile.targetWeightKg ?? null,
    target_lift_exercise: profile.targetLiftExercise ?? null,
    target_lift_weight_kg: profile.targetLiftWeightKg ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Best-effort remote mirror of the local profile — see
 * supabase/migrations/20260903010000_profile_sync.sql for why this exists
 * and the table it writes to. Fire-and-forget by design, same as every
 * local write in this app: a failed push never blocks or fails the local
 * save that already succeeded, and the next successful save just tries
 * again. Silently does nothing when signed out — there's no account to
 * sync to yet, and that's a normal, expected state, not an error.
 *
 * `supabase` is imported dynamically (not at module top-level) so that
 * merely importing this file — which user-profile.ts's saveProfile now
 * does unconditionally — never eagerly evaluates lib/supabase.ts, which
 * throws at import time if EXPO_PUBLIC_SUPABASE_URL/ANON_KEY aren't set.
 * Jest doesn't load .env.local the way Expo's own CLI does, so a static
 * top-level import here broke every test that transitively imports
 * user-profile.ts (confirmed: it crashed data-backup.test.ts) even though
 * those tests never call either function below.
 */
export async function pushProfileToRemote(profile: UserProfile): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const row = remoteProfileRow(profile, user.id);
    const { error } = await supabase.from('profiles').upsert(row);
    // Until 20260928000000_profiles_equipment.sql is deployed, the server
    // rejects the whole row over the one column it doesn't have — sync
    // everything else rather than nothing.
    if (error && /equipment/i.test(error.message ?? '')) {
      const { equipment: _notYetSynced, ...withoutEquipment } = row;
      await supabase.from('profiles').upsert(withoutEquipment);
    }
  } catch {
    // Best-effort — see this function's own doc comment.
  }
}

export type RemoteProfileResult =
  | { kind: 'found'; profile: UserProfile }
  | { kind: 'none' }
  | { kind: 'error' };

/**
 * Called from auth/verify.tsx's and create-account.tsx's own "no local
 * profile" branches, before they fall back to routing a verified sign-in
 * through onboarding — a real account with a synced profile should never
 * see the questionnaire again just because it's a new device.
 *
 * BUG FIX: this used to return null for BOTH "this account has no synced
 * profile" and "couldn't reach the server" — so signing in on a new device
 * with a weak connection sent a fully set-up account back through the
 * whole questionnaire, and finishing it overwrote the real synced profile.
 * 'error' now means "try again", never "start over".
 */
export async function pullProfileFromRemote(): Promise<RemoteProfileResult> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { kind: 'error' };
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) return { kind: 'error' };
    if (!data) return { kind: 'none' };
    const profile: UserProfile = {
      name: data.name ?? undefined,
      email: user.email ?? undefined,
      goal: data.goal ?? undefined,
      experience: data.experience ?? undefined,
      environment: data.environment ?? undefined,
      equipment: data.equipment ?? undefined,
      duration: data.duration ?? undefined,
      commitmentLevel: data.commitment_level ?? undefined,
      days: data.days ?? undefined,
      healthConsent: data.health_consent ?? undefined,
      healthConsentedAt: data.health_consented_at ?? undefined,
      sex: data.sex ?? undefined,
      heightCm: data.height_cm ?? undefined,
      weightKg: data.weight_kg ?? undefined,
      conditions: data.conditions ?? undefined,
      movementRestrictions: data.movement_restrictions ?? undefined,
      age: data.age ?? undefined,
      targetWeightKg: data.target_weight_kg ?? undefined,
      targetLiftExercise: data.target_lift_exercise ?? undefined,
      targetLiftWeightKg: data.target_lift_weight_kg ?? undefined,
    };
    return { kind: 'found', profile };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * Deletes the signed-in user's synced profile row — Settings' "Delete My
 * Data" calls this alongside clearing the device, so "permanently clears
 * your profile" is true on the server too (health fields included). Needs
 * 20260923000100_profiles_delete_own.sql deployed; best-effort like every
 * other sync call here, and deliberately NOT part of clearAllLocalData,
 * which account-switch.ts also uses while a different account is signed in.
 */
export async function deleteRemoteProfile(): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('profiles').delete().eq('user_id', session.user.id);
  } catch {
    // Best-effort — see this function's own doc comment.
  }
}
