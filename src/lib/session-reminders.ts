import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ENABLED_KEY = 'vervein.remindersEnabled.v1';
// Every reminder this module schedules carries this identifier prefix, so
// disabling (or re-enabling with a changed schedule) can cancel exactly its
// own notifications via cancelScheduledNotificationAsync — never a blanket
// cancelAllScheduledNotificationsAsync, which would also wipe out any other
// feature that schedules its own local notifications later.
const ID_PREFIX = 'vervein-session-reminder-';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const REMINDER_HOUR = 8;
const REMINDER_MINUTE = 0;

// expo-notifications needs native code baked into the app binary — present
// in a real dev-client or production build with this project's own
// app.json plugin entry included, but never in the generic Expo Go app
// (which can't bundle project-specific native modules at all), and not in
// any dev-client build compiled before that plugin entry was added either.
// The package's own index.js does an EAGER, top-level
// requireNativeModule('ExpoPushTokenManager') the instant it's imported —
// that throws synchronously.
//
// DISCLOSED FIX HISTORY: a first attempt loaded this via `await
// import('expo-notifications')` wrapped in try/catch, on the assumption
// that Metro turns a synchronous throw during a dynamic import's module
// evaluation into a rejected promise (the same defensive shape
// health-kit.ts's own getModule() uses successfully for its native module).
// That assumption was wrong for THIS package in this Metro version: the
// throw surfaced as an uncaught error through Metro's own async-require
// machinery (asyncRequireModule.ts / metroImportAll) before the returned
// promise was ever available to be awaited, so the try/catch around it
// never ran. A lazy, function-scoped, SYNCHRONOUS `require(...)` call
// behaves like an ordinary JS function call at runtime instead of routing
// through that async module system — a plain try/catch around it reliably
// catches the native-module error. Still lazy (never called at module top
// level) and still cached after the first attempt, same as before; only
// the loading mechanism changed.
let cachedModule: typeof import('expo-notifications') | null | undefined;
function getModule(): typeof import('expo-notifications') | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see the disclosed fix-history comment above for why this must be a synchronous require(), not a dynamic import().
    cachedModule = require('expo-notifications');
  } catch {
    cachedModule = null;
  }
  // TS can't narrow a try/catch-assigned `let` back to its declared union
  // after the block (require()'s return type is `any`, so the compiler
  // can't rule out `undefined` surviving both branches) — the `?? null`
  // is a real, correct fallback regardless: if cachedModule is somehow
  // still undefined here, "module not available" (null) is exactly right.
  return cachedModule ?? null;
}

/**
 * Whether local notifications are usable in this build at all — false in
 * Expo Go or a stale dev-client missing the native module. Settings' own
 * Workout Reminders row uses this (alongside its scheduledDaysCount > 0
 * check) so the toggle honestly shows itself as unavailable rather than
 * looking interactive and silently failing the moment it's tapped.
 */
export async function isReminderSupported(): Promise<boolean> {
  return getModule() !== null;
}

export async function isReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Re-verifies the real OS permission (not just the stored preference) —
 * Settings' own reminder toggle uses this on every focus so a permission
 * revoked in system Settings since being turned on here doesn't leave the
 * toggle showing "on" for something that can't actually fire. Settings.tsx
 * never imports expo-notifications directly itself — this module stays the
 * one place that does, so the crash-guard above only has to live in one spot.
 */
export async function isReminderPermissionGranted(): Promise<boolean> {
  const Notifications = getModule();
  if (!Notifications) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function cancelAllReminders(Notifications: typeof import('expo-notifications')): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Requests OS permission (only ever called from the user's own explicit
 * Settings toggle — never on app launch or any other unprompted path) and,
 * if granted, schedules one WEEKLY-repeating local notification per
 * scheduled training day at a fixed 8am local time. Same neutral,
 * no-guilt register as momentum.ts's own copy — no streak framing, no "keep
 * it going," and never fires for a day that isn't actually scheduled.
 * Returns false (and schedules nothing) if permission was denied OR if the
 * native module genuinely isn't available in this build (Expo Go, or a
 * stale dev-client) — the caller is responsible for reverting its own
 * toggle UI in either case; it can't tell the two apart, which is fine,
 * since the toggle already gates on availability separately (see
 * isReminderPermissionGranted / Settings' own healthKitAvailable-style check).
 */
export async function enableSessionReminders(scheduledDays: string[]): Promise<boolean> {
  const Notifications = getModule();
  if (!Notifications) return false;

  try {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await cancelAllReminders(Notifications);
    await Promise.all(
      scheduledDays.map((day) => {
        const weekdayIndex = WEEKDAY_NAMES.indexOf(day);
        if (weekdayIndex === -1) return Promise.resolve(); // unrecognized value — skip, never guess
        return Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${day}`,
          content: { title: 'Training day', body: 'Whenever works today.' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: weekdayIndex + 1, // WeeklyTriggerInput: 1 = Sunday
            hour: REMINDER_HOUR,
            minute: REMINDER_MINUTE,
          },
        });
      })
    );
  } catch {
    return false;
  }

  try {
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
  } catch {
    // Worst case the preference doesn't persist across an app restart —
    // the notifications themselves are already scheduled either way.
  }
  return true;
}

export async function disableSessionReminders(): Promise<void> {
  const Notifications = getModule();
  if (Notifications) {
    try {
      await cancelAllReminders(Notifications);
    } catch {
      // Worst case a stale reminder fires once more — never a crash, and
      // the stored preference below still turns the toggle off either way.
    }
  }
  try {
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
  } catch {
    // Worst case the preference doesn't persist — the real cancellation
    // above already happened regardless.
  }
}
