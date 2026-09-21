import Constants from 'expo-constants';

import { getModule } from '@/lib/session-reminders';

/**
 * Remote push token registration — the client half of remote push. This
 * only gets a real Expo push token and stores it in `push_tokens` (see
 * supabase/migrations/20260916000000_push_tokens.sql); it does not send
 * anything by itself. Actually sending a remote push still needs its own
 * trigger (a scheduled Edge Function, a database webhook off some real
 * event) reading tokens from that table and POSTing to Expo's push API —
 * that doesn't exist yet, deliberately: there's no defined send-worthy
 * event yet to build a sender around.
 *
 * Reuses session-reminders.ts's own `getModule()` rather than a fresh
 * lazy-require of expo-notifications — see that function's own comment for
 * why a plain `import('expo-notifications')` crashes in a build missing the
 * native module, a real, previously-diagnosed failure mode in this app.
 *
 * Fire-and-forget, same as profile-sync.ts's own pushProfileToRemote: a
 * failed registration never blocks anything the caller is doing, and the
 * next successful app open just tries again. Silently no-ops when signed
 * out, when the permission prompt is denied, or when running somewhere a
 * push token can't be issued (Simulator) — none of those are errors, they're
 * normal states this app already treats the same way for local reminders.
 */
export async function registerForRemotePushNotifications(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  // Physical-device-only, same restriction Apple/Google's own push services
  // impose — the Simulator/most emulators have no real APNs/FCM connection
  // to issue a token through, so this fails safely rather than throwing.
  if (!Constants.isDevice) return;

  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (existing.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('push_tokens').upsert({ user_id: user.id, expo_push_token: expoPushToken });
  } catch {
    // Never a crash — worst case this device just doesn't receive a remote
    // push later, same "under-triggering is the safe failure mode" rule
    // every other optional integration in this app already follows.
  }
}
