// Shared Expo push sender — both redeem-referral (referral notification) and
// send-reengagement-pushes (inactivity nudge) send through Expo's push
// service this exact same way (see src/lib/push-notifications.ts's own
// comment on why: this app never talks to APNs/FCM directly, only Expo's
// hosted push service, so every server-side sender goes through this one
// endpoint too). Kept here so both functions share one request shape
// instead of two independently-drifting copies of the same fetch call.
//
// Never throws — a failed push must never fail or roll back whatever real,
// already-succeeded action triggered it (a referral redemption grants its
// reward either way; a re-engagement scan just tries the next user).
// Callers don't need their own try/catch around these; the swallowing
// happens here once.

// @ts-expect-error — npm: specifier resolution is a Deno/Supabase Edge
// Runtime feature; the local TS toolchain has no visibility into Deno's
// module resolution, so this import is expected to show a type error here
// while being completely valid at actual deploy/runtime (same disclosed
// pattern as redeem-referral/index.ts's own createClient import).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Expo's own documented cap per request — send-reengagement-pushes' whole
// daily run splits into this many requests rather than one, so a quiet
// stretch with more than one page's worth of inactive users doesn't just
// silently drop everyone past the first 100 the way a single unchunked
// request would.
const EXPO_PUSH_BATCH_SIZE = 100;

/**
 * Raw batch send — Expo's API accepts an array in one request rather than
 * one call per token, chunked to respect EXPO_PUSH_BATCH_SIZE above.
 */
export async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
    const chunk = messages.slice(i, i + EXPO_PUSH_BATCH_SIZE);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
    } catch {
      // Never a crash — see this file's own header comment. Continues to
      // the next chunk rather than aborting the whole run over one failed
      // request.
    }
  }
}

/**
 * Looks up every device currently registered for one user and sends the
 * same title/body/data to each — a user signed in on two devices (e.g. an
 * old phone still logged in) gets notified on both rather than only
 * whichever registered most recently. Used by redeem-referral, which only
 * ever notifies a single user (the referrer) per call, so a dedicated
 * per-user helper reads clearer there than reaching for the batch function
 * with a one-user query inlined at the call site.
 */
export async function sendExpoPushToUser(
  adminClient: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: tokens } = await adminClient
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId);
    const messages: ExpoPushMessage[] = (tokens ?? []).map((row: { expo_push_token: string }) => ({
      to: row.expo_push_token,
      title,
      body,
      data,
    }));
    await sendExpoPushBatch(messages);
  } catch {
    // Never a crash — see this file's own header comment.
  }
}
