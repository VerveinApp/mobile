import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Excludes 0/O and 1/I/L — a code read aloud or typed by hand from a
// friend's screen shouldn't hinge on telling those apart.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_INSERT_ATTEMPTS = 5;

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export type GetReferralCodeOutcome =
  | { ok: true; code: string }
  | { ok: false; reason: 'not-signed-in' | 'error' };

/**
 * Returns this user's existing referral code, generating and persisting one
 * on first call. Generation happens client-side with a retry on the rare
 * unique-constraint collision — see
 * supabase/migrations/20260829000000_referral_system.sql's own comment on
 * why no Edge Function is needed just to hand out a code: RLS only allows
 * inserting a row with your own user_id, so this can never collide with or
 * overwrite anyone else's.
 *
 * Distinguishes "not signed in" from "a real failure" (a transient DB error,
 * or exhausting MAX_INSERT_ATTEMPTS) — collapsing both into one null used to
 * leave a signed-in user staring at "Sign in to get your referral code,"
 * with no way to tell that's not actually the problem, and no retry.
 *
 * getUser() (unlike Settings' own "Signed in" row, which reads getSession()'s
 * locally cached session) makes a live round-trip to Supabase's Auth server
 * to actually re-validate the token — so it can fail on a network hiccup for
 * someone who's genuinely still signed in. Checking its own `error` here
 * (not just whether `user` came back falsy) keeps that failure from being
 * misreported as "not signed in" too.
 */
export async function getOrCreateReferralCode(): Promise<GetReferralCodeOutcome> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false, reason: 'error' };
  if (!user) return { ok: false, reason: 'not-signed-in' };

  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing?.code) return { ok: true, code: existing.code as string };

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const code = randomCode();
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({ user_id: user.id, code })
      .select('code')
      .single();
    if (!error && data) return { ok: true, code: data.code as string };
    // Postgres 23505 = unique_violation — the only expected failure here,
    // worth retrying with a fresh random code. Anything else (network, RLS
    // misconfig) isn't worth retrying blindly.
    if (error && error.code !== '23505') return { ok: false, reason: 'error' };
  }
  return { ok: false, reason: 'error' };
}

export type RedeemReferralOutcome =
  | { ok: true; rewardGranted: boolean }
  | { ok: false; notDeployed: boolean; error: string };

/**
 * Calls the redeem-referral Edge Function — see that file's own doc comment
 * for why this can't be a direct client insert (resolving a code to its
 * owner across two accounts, and the actual RevenueCat reward grant, both
 * need privileged/secret access this client never has).
 *
 * DISCLOSED: same "written but not yet deployed" state as account.ts's
 * deleteAccount — until `supabase functions deploy redeem-referral` has
 * actually been run, every real call here will fail, and this honestly
 * reports that instead of pretending a reward was granted.
 */
export async function redeemReferralCode(code: string): Promise<RedeemReferralOutcome> {
  const { data, error } = await supabase.functions.invoke('redeem-referral', { body: { code } });
  if (!error) {
    const body = data as { rewardGranted?: boolean } | null;
    return { ok: true, rewardGranted: body?.rewardGranted === true };
  }

  if (error instanceof FunctionsRelayError) {
    const status = (error.context as Response | undefined)?.status;
    if (status === 404) {
      return {
        ok: false,
        notDeployed: true,
        error: "Referrals aren't set up on the server yet — try again later.",
      };
    }
    return { ok: false, notDeployed: false, error: "Couldn't reach the server. Check your connection and try again." };
  }

  if (error instanceof FunctionsHttpError) {
    let message = "Couldn't redeem that code. Try again.";
    try {
      const body = (await (error.context as Response).json()) as { error?: string };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // Non-JSON body — fall back to the generic message above.
    }
    return { ok: false, notDeployed: false, error: message };
  }

  return { ok: false, notDeployed: false, error: "Couldn't reach the server. Check your connection and try again." };
}
