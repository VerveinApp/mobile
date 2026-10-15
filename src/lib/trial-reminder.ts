import type { CustomerInfo } from 'react-native-purchases';

import { getModule } from '@/lib/session-reminders';

const TRIAL_ENDING_ID = 'vervein-trial-ending';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the "trial ends tomorrow" reminder should fire for an entitlement,
 * or null when there shouldn't be one: only a real free trial (not the
 * referral week, which is promotional and doesn't convert) that is still
 * set to renew, and only while a day-before moment is still ahead.
 */
export function trialReminderTime(
  entitlement: { periodType: string; willRenew: boolean; expirationDate: string | null } | undefined,
  now: number = Date.now()
): number | null {
  if (!entitlement || entitlement.periodType !== 'TRIAL' || !entitlement.willRenew || !entitlement.expirationDate) {
    return null;
  }
  const at = Date.parse(entitlement.expirationDate) - DAY_MS;
  return Number.isFinite(at) && at > now + 60_000 ? at : null;
}

/**
 * Keeps the one "your trial ends tomorrow" notification matching the
 * subscription: scheduled while a trial is set to convert, cancelled the
 * moment it isn't (cancelled, converted, expired). The paywall promises
 * this reminder only when notifications are already allowed — this never
 * asks for permission.
 */
export async function syncTrialEndingReminder(info: CustomerInfo, entitlementId: string): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  try {
    const at = trialReminderTime(info.entitlements.active[entitlementId]);
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ENDING_ID);
    if (at === null || !(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_ENDING_ID,
      content: {
        title: 'Your VerveIn Plus trial ends tomorrow',
        body: 'Keep it and it renews then. To cancel, open Settings, tap your name, then Subscriptions.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch {
    // Worst case no reminder — Apple also emails before a trial converts.
  }
}
