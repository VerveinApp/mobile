import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { hasCompletedOnboarding } from '@/lib/onboarding-draft';
import { getModule } from '@/lib/session-reminders';

/**
 * Every screen a notification is allowed to open. A notification names its
 * screen in `data.url` (session-reminders.ts's workout reminders, and the
 * server's re-engagement and referral pushes); anything not on this list is
 * ignored, so a payload can never send someone to an arbitrary route.
 */
export const NOTIFICATION_ROUTES = ['/home/check-in', '/referral'] as const;
export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

/** The allowed screen a notification's data points at, or null. */
export function notificationRoute(data: unknown): NotificationRoute | null {
  if (typeof data !== 'object' || data === null) return null;
  const url = (data as { url?: unknown }).url;
  return typeof url === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(url)
    ? (url as NotificationRoute)
    : null;
}

/**
 * Opens the screen a tapped notification is about — a workout reminder or
 * "Rested and ready" lands on today's check-in instead of wherever the app
 * last was, and a referral notice on the invite screen that shows the
 * reward. Follows the pattern in Expo's notifications docs: the tap that
 * launched the app (read once, then cleared so a later remount can't replay
 * it), plus any tap while it's running.
 *
 * Mounted in the tabs layout, and only acts for an onboarded account — a
 * tap can't push someone past onboarding. A tap for the screen already
 * showing is ignored rather than stacking a second copy of it.
 */
export function useNotificationRedirect(): void {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const Notifications = getModule();
    if (!Notifications) return;
    let active = true;
    const follow = async (data: unknown) => {
      const route = notificationRoute(data);
      if (!route || !(await hasCompletedOnboarding()) || !active) return;
      if (pathnameRef.current === route) return;
      router.push(route as never);
    };
    const launchResponse = Notifications.getLastNotificationResponse();
    if (launchResponse) {
      Notifications.clearLastNotificationResponse();
      void follow(launchResponse.notification.request.content.data);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void follow(response.notification.request.content.data);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}
