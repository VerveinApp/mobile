import type { UserProfile } from '@/lib/user-profile';

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
    await supabase.from('profiles').upsert({
      user_id: user.id,
      name: profile.name ?? null,
      goal: profile.goal ?? null,
      experience: profile.experience ?? null,
      environment: profile.environment ?? null,
      duration: profile.duration ?? null,
      commitment_level: profile.commitmentLevel ?? null,
      days: profile.days ?? null,
      health_consent: profile.healthConsent ?? null,
      health_consented_at: profile.healthConsentedAt ?? null,
      sex: profile.sex ?? null,
      height_cm: profile.heightCm ?? null,
      weight_kg: profile.weightKg ?? null,
      conditions: profile.conditions ?? null,
      movement_restrictions: profile.movementRestrictions ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort — see this function's own doc comment.
  }
}

/**
 * Called from auth/verify.tsx's own "no local profile" branch, before it
 * falls back to routing a verified sign-in through onboarding — a real
 * account with a synced profile should never see the questionnaire again
 * just because it's a new device. Returns null both when signed out (never
 * expected here, verify.tsx only calls this right after a successful
 * verifyOtp/social sign-in) and when genuinely no row exists yet (a
 * pre-sync account, or one that was never fully onboarded) — callers treat
 * both the same way: nothing to restore.
 */
export async function pullProfileFromRemote(): Promise<UserProfile | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (!data) return null;
    return {
      name: data.name ?? undefined,
      email: user.email ?? undefined,
      goal: data.goal ?? undefined,
      experience: data.experience ?? undefined,
      environment: data.environment ?? undefined,
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
    };
  } catch {
    return null;
  }
}
