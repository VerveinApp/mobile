// Deno Edge Function — deployed to Supabase, never bundled into the app.
// Triggered on a daily schedule by pg_cron (see
// supabase/migrations/20260917000100_schedule_reengagement_cron.sql), not by
// any client — there is no legitimate end-user reason to call this, and it
// takes no per-caller input (it scans every account itself), so it's meant
// to be deployed with --no-verify-jwt (see this file's own DEPLOY block)
// rather than routed through the Vault-secret dance a JWT-protected
// function invoked from pg_cron would otherwise need.
//
// WHY push_tokens.updated_at, NOT auth.users.last_sign_in_at: this app's
// Supabase session persists indefinitely (see src/lib/supabase.ts — no
// forced re-login), so last_sign_in_at only moves on a genuine new
// sign-in/OAuth grant, not on the silent background token refresh that
// keeps an already-open, already-signed-in session alive. Someone opening
// the app daily for months could still show a last_sign_in_at from their
// very first day. push_tokens.updated_at, by contrast, is re-upserted on
// every real cold launch (see src/lib/push-notifications.ts, called from
// the root layout's own useEffect) — it's a direct measure of "did the app
// actually open recently," not "did an auth event fire recently." (Only
// true since 20260923000000_push_tokens_touch_updated_at.sql: before that,
// re-registration never advanced updated_at, so every user read as
// inactive three days after first registering.) It's also
// exactly the right table to query anyway: a user with no row here has no
// token to push to regardless of how active they are, so there's nothing
// to gain from also joining against last_sign_in_at for those users.
//
// DEPLOY (not done by this repo — needs your own Supabase login):
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase db push
//   supabase functions deploy send-reengagement-pushes --no-verify-jwt
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// Supabase into every deployed function's environment.

// @ts-expect-error — npm: specifier resolution is a Deno/Supabase Edge
// Runtime feature; the local TS toolchain has no visibility into Deno's
// module resolution and can't type-check this file the way it checks the
// React Native app, so this import is expected to show a type error here
// while being completely valid at actual deploy/runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendExpoPushBatch } from '../_shared/expo-push.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Someone genuinely just hasn't opened the app in a few days — a real,
// worth-nudging gap, not a same-day "why haven't you finished today's
// session yet" pressure the local check-in reminders already own.
const INACTIVITY_THRESHOLD_DAYS = 3;
// Once nudged, leave them alone for a week before trying again — daily
// "come back!" pushes to someone who's already seen and ignored one reads
// as spam and is a real, documented way to get an app uninstalled or its
// notifications turned off entirely, undoing the whole point of this.
const RENOTIFY_COOLDOWN_DAYS = 7;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const inactiveSince = new Date(Date.now() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cooldownSince = new Date(Date.now() - RENOTIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Most-recently-active device per user, not every row — a user with one
  // stale token and one fresh one (an old phone still signed in alongside
  // their current one) is still actively using the app and shouldn't be
  // called inactive just because SOME registration is old.
  const { data: tokenRows, error: tokenError } = await adminClient
    .from('push_tokens')
    .select('user_id, expo_push_token, updated_at')
    .order('updated_at', { ascending: false });
  if (tokenError) {
    return jsonResponse({ error: tokenError.message }, 500);
  }

  const latestByUser = new Map<string, string>();
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row.updated_at);
    const existing = tokensByUser.get(row.user_id) ?? [];
    existing.push(row.expo_push_token);
    tokensByUser.set(row.user_id, existing);
  }
  const inactiveUserIds = [...latestByUser.entries()]
    .filter(([, lastActive]) => lastActive < inactiveSince)
    .map(([userId]) => userId);
  if (inactiveUserIds.length === 0) {
    return jsonResponse({ notified: 0 }, 200);
  }

  const { data: recentlyNotified, error: stateError } = await adminClient
    .from('notification_state')
    .select('user_id, last_reengagement_sent_at')
    .in('user_id', inactiveUserIds)
    .gte('last_reengagement_sent_at', cooldownSince);
  if (stateError) {
    return jsonResponse({ error: stateError.message }, 500);
  }
  const skipUserIds = new Set((recentlyNotified ?? []).map((row: { user_id: string }) => row.user_id));
  const toNotify = inactiveUserIds.filter((userId) => !skipUserIds.has(userId));
  if (toNotify.length === 0) {
    return jsonResponse({ notified: 0 }, 200);
  }

  const messages = toNotify.flatMap((userId) =>
    (tokensByUser.get(userId) ?? []).map((token) => ({
      to: token,
      // Readiness, not debt — "your training is waiting" framed a few quiet
      // days as something owed, the exact register this app avoids
      // everywhere else. A few days off reads as recovered, because it is.
      title: 'Rested and ready',
      body: 'A few days off means you’re recovered — even a short session counts, whenever you’re ready.',
    }))
  );
  await sendExpoPushBatch(adminClient, messages);

  // Recorded regardless of whether Expo's API actually accepted every
  // message — sendExpoPushBatch already treats a delivery failure as a
  // silent, retryable-next-time no-op (see its own header comment); what
  // this cooldown tracks is "did we already TRY this person recently," not
  // "did it definitely land," so someone with a since-invalidated token
  // doesn't get retried daily by this job forever either.
  const now = new Date().toISOString();
  await adminClient
    .from('notification_state')
    .upsert(toNotify.map((userId) => ({ user_id: userId, last_reengagement_sent_at: now })));

  return jsonResponse({ notified: toNotify.length }, 200);
});
