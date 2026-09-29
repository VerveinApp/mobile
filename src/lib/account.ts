import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; notDeployed: boolean; error: string };

/**
 * Calls the delete-account Edge Function (supabase/functions/delete-account
 * — see that file's own doc comment for what it does server-side and why
 * this can't be a direct client-SDK call: it needs the service-role key,
 * which must never ship inside the app bundle).
 *
 * Deployed 2026-09-13 (`supabase functions deploy delete-account`) — live
 * and verified (returns 401 without a session, not 404). The `notDeployed`
 * path below is kept as a defensive fallback, not dead code: Supabase's edge
 * relay reports an unknown function slug as a 404 with an `x-relay-error`
 * header, which the SDK surfaces as a `FunctionsRelayError` — this function
 * checks for exactly that shape and reports it as `notDeployed: true` with
 * an honest message, rather than a generic "something went wrong" the user
 * can't act on, in case the function is ever removed or redeployed under a
 * different slug.
 * `FunctionsHttpError` (the function DID run, and returned a non-2xx —
 * e.g. an expired session) is a distinct, real failure and is reported
 * with whatever message the function itself sent back.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (!error) return { ok: true };

  if (error instanceof FunctionsRelayError) {
    const status = (error.context as Response | undefined)?.status;
    if (status === 404) {
      return {
        ok: false,
        notDeployed: true,
        error: "Account deletion isn't set up on the server yet — try again later, or contact support.",
      };
    }
    return { ok: false, notDeployed: false, error: "Couldn't reach the server. Check your connection and try again." };
  }

  if (error instanceof FunctionsHttpError) {
    let message = 'Something went wrong deleting your account. Try again.';
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
