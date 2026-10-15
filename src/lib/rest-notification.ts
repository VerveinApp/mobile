import { getModule } from '@/lib/session-reminders';

// Its own identifier, outside session-reminders.ts's ID_PREFIX, so
// rescheduling reminders never cancels a rest in progress (and the reverse).
const REST_OVER_ID = 'vervein-rest-over';

// Bumped by every schedule and cancel. A cancel that lands while a schedule
// is still checking permission wins: the schedule sees the bump and stops,
// so coming straight back to the app can't leave a stale "Rest's up" queued.
let generation = 0;

/**
 * One local notification at the moment a rest ends, for when the app isn't
 * on screen to show it (phone locked, another app open). Only when
 * notifications are already allowed — a workout is never the place to ask.
 * Tapping it opens the session (see notification-redirect.ts).
 */
export async function scheduleRestOverNotification(endsAt: number, body: string): Promise<void> {
  const Notifications = getModule();
  if (!Notifications || endsAt - Date.now() < 1000) return;
  const mine = ++generation;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted || mine !== generation) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REST_OVER_ID,
      content: { title: "Rest's up", body, sound: 'default', data: { url: '/home/check-in' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt },
    });
  } catch {
    // Worst case the rest ends silently in a pocket — the clock still has
    // the right time on return.
  }
}

export async function cancelRestOverNotification(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  generation += 1;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_OVER_ID);
  } catch {
    // Nothing scheduled, or the module is unavailable — nothing to undo.
  }
}
