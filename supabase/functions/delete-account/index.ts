// Deno Edge Function — deployed to Supabase, never bundled into the app.
// This is the one place in the whole project that's allowed to touch the
// service-role key, because it's the one place that has to: deleting an
// auth user is a privileged operation the client SDK deliberately can't do
// with the public anon key (see src/lib/supabase.ts's own comment on why
// the anon key relies on RLS, not secrecy — this function is the opposite:
// its key must stay a real secret, only ever set via `supabase secrets set`
// or the dashboard, never checked into the repo or shipped in a build).
//
// SECURITY: never trusts a client-supplied user id. The only account this
// function can ever delete is whichever one owns the JWT in the request's
// own Authorization header — verified server-side via a SEPARATE,
// anon-key-scoped client's auth.getUser() call before the privileged
// service-role client is touched at all. A forged or missing/expired token
// fails at that verification step, before deletion is even attempted.
//
// DEPLOY (not done by this repo — needs your own Supabase login):
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase functions deploy delete-account
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// Supabase into every deployed function's environment — no manual secret
// needs to be set for those two specifically.
//
// See src/lib/account.ts for the client-side call, and settings/index.tsx
// for the confirm-gated UI that invokes it. Until deployed, that UI
// honestly reports the failure rather than pretending to have deleted
// anything — see deleteAccount()'s own doc comment.

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
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Never reachable in a real deployed function — Supabase always injects
    // these three. A missing one here means something is misconfigured, not
    // that this should silently proceed with weaker auth.
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  // Anon-scoped client, carrying the CALLER's own token — used only to
  // verify who's actually asking, never to perform the deletion itself.
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

  // Service-role client — the only client in this function permitted to
  // delete a user, and only ever called with the id verified above, never
  // anything read from the request body.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ success: true }, 200);
});
