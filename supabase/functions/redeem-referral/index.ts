// Deno Edge Function — deployed to Supabase, never bundled into the app.
// Redeeming a referral code needs three things a client can never be
// trusted to do itself: (1) resolve a code to the referrer's user id across
// two different accounts (referral_codes' own RLS policy only lets a user
// read their OWN row — see supabase/migrations/20260829000000_referral_system.sql),
// (2) reject self-referral and a second redemption on the same account
// atomically, and (3) call RevenueCat's promotional-entitlement endpoint,
// which requires a Secret API key that must never ship inside the app
// bundle (see src/lib/purchases.ts's own comment on the PUBLIC key it uses
// instead — this function's key is the opposite: a real secret, only ever
// set via `supabase secrets set`, never checked into the repo).
//
// SECURITY: never trusts a client-supplied user id, same pattern as
// delete-account — the only account that can redeem is whichever one owns
// the JWT in the request's own Authorization header, verified server-side
// via a separate anon-key-scoped client before the privileged service-role
// client is touched at all.
//
// DEPLOY (not done by this repo — needs your own Supabase login):
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase db push
//   supabase functions deploy redeem-referral
//   supabase secrets set REVENUECAT_SECRET_KEY=sk_...
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// Supabase into every deployed function's environment.
// REVENUECAT_SECRET_KEY is the Secret API key from the RevenueCat dashboard
// (Project Settings > API Keys) — distinct from the public
// EXPO_PUBLIC_REVENUECAT_API_KEY_IOS the app itself uses.
//
// See src/lib/referral.ts for the client-side call.

// @ts-expect-error — npm: specifier resolution is a Deno/Supabase Edge
// Runtime feature; the local TS toolchain (tsc/expo lint) has no visibility
// into Deno's module resolution and can't type-check this file the way it
// checks the React Native app, so this import is expected to show a type
// error here while being completely valid at actual deploy/runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Matches PREMIUM_ENTITLEMENT_ID in src/lib/purchases.ts exactly — the
// RevenueCat entitlement identifier configured in the dashboard, including
// the space.
const ENTITLEMENT_ID = 'VerveIn Plus';
const REWARD_DAYS = 7;
// Without this, redemption eligibility was only "not yourself, not twice" —
// nothing tied it to actually being a new user, so two existing accounts
// could swap codes and each collect a reward with no real growth happening
// (the referral-farming failure mode the research behind this feature
// itself warned about). A week is generous enough that a real new user
// discovering the redeem screen through Settings or the first-session
// milestone prompt (not part of onboarding itself yet) still has time to
// use it, while still requiring an account to be genuinely fresh.
const NEW_ACCOUNT_WINDOW_DAYS = 7;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Grants a free week via RevenueCat's promotional-entitlement endpoint.
 * Uses end_time_ms rather than the (deprecated) duration enum — a fixed
 * end timestamp is the current recommended shape per RevenueCat's own docs.
 * Returns whether the grant actually succeeded so the caller can record an
 * honest reward_granted_at instead of assuming success.
 */
async function grantPromotionalMonth(appUserId: string, secretKey: string): Promise<boolean> {
  const endTimeMs = Date.now() + REWARD_DAYS * 24 * 60 * 60 * 1000;
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(ENTITLEMENT_ID)}/promotional`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ end_time_ms: endTimeMs }),
    }
  );
  if (!response.ok) {
    // Only diagnostic surface for a failed grant — without this, a wrong
    // entitlement identifier or a rotated/revoked secret key fails silently
    // forever (the redemption itself still succeeds either way, so nothing
    // in the client ever surfaces it).
    console.error(`RevenueCat promotional grant failed for ${appUserId}: ${response.status} ${await response.text()}`);
  }
  return response.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  let code: unknown;
  try {
    ({ code } = await req.json());
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
  if (typeof code !== 'string' || code.trim().length === 0) {
    return jsonResponse({ error: 'Missing referral code' }, 400);
  }
  const normalizedCode = code.trim().toUpperCase();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !revenueCatSecretKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  // Anon-scoped client, carrying the CALLER's own token — used only to
  // verify who's actually redeeming, never to perform the redemption itself.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }
  const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
  if (accountAgeMs > NEW_ACCOUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return jsonResponse({ error: 'Referral codes can only be redeemed within your first week.' }, 403);
  }

  // Service-role client from here on — the only one allowed to read another
  // user's referral_codes row or write referral_redemptions at all (see the
  // migration's own comment on why that table has no RLS policies).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: existingRedemption } = await adminClient
    .from('referral_redemptions')
    .select('id')
    .eq('referred_id', user.id)
    .maybeSingle();
  if (existingRedemption) {
    return jsonResponse({ error: "You've already redeemed a referral code." }, 409);
  }

  const { data: referralCode, error: codeError } = await adminClient
    .from('referral_codes')
    .select('user_id')
    .eq('code', normalizedCode)
    .maybeSingle();
  if (codeError || !referralCode) {
    return jsonResponse({ error: "That code doesn't look right — check it and try again." }, 404);
  }
  if (referralCode.user_id === user.id) {
    return jsonResponse({ error: "You can't redeem your own code." }, 400);
  }

  const { error: insertError } = await adminClient.from('referral_redemptions').insert({
    code: normalizedCode,
    referrer_id: referralCode.user_id,
    referred_id: user.id,
  });
  if (insertError) {
    // 23505 (unique_violation) on referred_id means a second concurrent
    // request from this same account (e.g. a double-tap) lost the race
    // against the existingRedemption check above — same real outcome as
    // that check catching it, so it gets the same honest message rather
    // than a generic failure.
    if (insertError.code === '23505') {
      return jsonResponse({ error: "You've already redeemed a referral code." }, 409);
    }
    return jsonResponse({ error: 'Something went wrong redeeming that code. Try again.' }, 500);
  }

  // Both sides get the reward — the referrer for bringing a real new user,
  // the friend for showing up via a real invite rather than the cold
  // paywall. Grant failures here don't undo the redemption above: the
  // relationship is real either way, and reward_granted_at simply stays
  // null so it's honestly distinguishable from a granted reward rather than
  // silently claiming success.
  const [referrerGranted, friendGranted] = await Promise.all([
    grantPromotionalMonth(referralCode.user_id, revenueCatSecretKey),
    grantPromotionalMonth(user.id, revenueCatSecretKey),
  ]);
  const bothGranted = referrerGranted && friendGranted;
  if (bothGranted) {
    await adminClient
      .from('referral_redemptions')
      .update({ reward_granted_at: new Date().toISOString() })
      .eq('referred_id', user.id);
  }

  return jsonResponse({ success: true, rewardGranted: bothGranted }, 200);
});
