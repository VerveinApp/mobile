import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { getModule, getNotificationPermissionState } from '@/lib/session-reminders';

/**
 * Remote push token registration — the client half of remote push. This
 * only gets a real Expo push token and stores it in `push_tokens` (see
 * supabase/migrations/20260916000000_push_tokens.sql); it does not send
 * anything by itself. Two real senders read from that table and POST to
 * Expo's push API: supabase/functions/redeem-referral (on a referral
 * redemption) and supabase/functions/send-reengagement-pushes (a daily
 * cron, cooldown-limited per user — see notification_state.sql).
 *
 * Reuses session-reminders.ts's own `getModule()` rather than a fresh
 * lazy-require of expo-notifications — see that function's own comment for
 * why a plain `import('expo-notifications')` crashes in a build missing the
 * native module, a real, previously-diagnosed failure mode in this app.
 *
 * Fire-and-forget, same as profile-sync.ts's own pushProfileToRemote: a
 * failed registration never blocks anything the caller is doing, and the
 * next successful app open just tries again. Silently no-ops when signed
 * out, when notification permission hasn't been granted, or when running
 * somewhere a push token can't be issued (Simulator) — none of those are
 * errors, they're normal states this app already treats the same way for
 * local reminders.
 *
 * BUG FIX: this used to call requestPermissionsAsync() itself on every cold
 * launch — before the signed-in check, so the OS permission prompt fired
 * over the Welcome screen on a brand-new install, before anyone knew what
 * the app was. A reflexive "Don't Allow" there can never be re-asked, which
 * silently killed reminders for good. This now only REGISTERS when
 * permission already exists; the actual ask happens in context — the
 * Settings reminder toggle and the one-time post-session offer (see
 * session-reminders.ts's shouldOfferReminderPrompt) — and both call this
 * right after a grant so the token doesn't wait for the next cold launch.
 */
// The token this device last registered, so it can be removed later without
// asking iOS for it again — which only works while notifications are still
// allowed, exactly the case where removal matters least.
const REGISTERED_TOKEN_KEY = 'vervein.pushToken.v1';

/**
 * Deletes this device's last-registered token from the account's rows. The
 * local copy is only forgotten once the server delete succeeds, so a failed
 * attempt (offline) is retried on the next launch or sign-out.
 */
async function removeRegisteredToken(supabase: SupabaseClient, userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
  if (!token) return;
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId).eq('expo_push_token', token);
  if (!error) await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY);
}

export async function registerForRemotePushNotifications(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  // Physical-device-only, same restriction Apple/Google's own push services
  // impose — the Simulator/most emulators have no real APNs/FCM connection
  // to issue a token through, so this fails safely rather than throwing.
  if (!Constants.isDevice) return;

  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // Notifications turned off in iOS Settings since the last launch: the
    // token stays valid with Apple, so nothing would ever prune it — the
    // Privacy Policy keeps tokens only until "the device stops accepting
    // notifications", so it's removed here instead.
    if ((await getNotificationPermissionState()) !== 'granted') {
      await removeRegisteredToken(supabase, session.user.id);
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    // updated_at is what the server's re-engagement scan reads as "last
    // opened" — sent explicitly, and also maintained by a trigger (see
    // 20260923000000_push_tokens_touch_updated_at.sql, which also adds the
    // UPDATE grant this upsert's conflict path needs).
    const { error } = await supabase.from('push_tokens').upsert({
      user_id: session.user.id,
      expo_push_token: expoPushToken,
      updated_at: new Date().toISOString(),
    });
    if (!error) await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, expoPushToken);
  } catch {
    // Never a crash — worst case this device just doesn't receive a remote
    // push later, same "under-triggering is the safe failure mode" rule
    // every other optional integration in this app already follows.
  }
}

/**
 * Removes THIS device's token for the signed-in account — call before
 * signing out. Without it a signed-out phone kept receiving the previous
 * account's pushes (re-engagement nudges, referral notices), including after
 * someone else signed in on it. Same best-effort contract as registration;
 * the server-side cascade already covers Delete Account.
 */
export async function unregisterPushTokenForThisDevice(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications || !Constants.isDevice) return;
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    // The remembered token first: it works even after notifications were
    // turned off, when iOS won't hand the token out again. Asking iOS is only
    // the fallback for a device registered before the token was remembered.
    if (await AsyncStorage.getItem(REGISTERED_TOKEN_KEY)) {
      await removeRegisteredToken(supabase, session.user.id);
      return;
    }
    if ((await getNotificationPermissionState()) !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('user_id', session.user.id).eq('expo_push_token', expoPushToken);
  } catch {
    // Worst case the server prunes it later (DeviceNotRegistered) — never a crash.
  }
}
