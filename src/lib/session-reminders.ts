import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getMostNeglectedBodyArea } from '@/lib/engine/training-state';
import { localDateStr } from '@/lib/local-date';
import { BODY_AREA_PRIORITY_LABEL } from '@/lib/plan-preview';
import { getSessionHistory } from '@/lib/session-history';
import { getTrainingState } from '@/lib/training-state';
import { getProfile } from '@/lib/user-profile';

const ENABLED_KEY = 'vervein.remindersEnabled.v1';
const LAST_RESCHEDULED_KEY = 'vervein.remindersLastRescheduled.v1';
// Every reminder this module schedules carries this identifier prefix, so
// disabling (or re-enabling with a changed schedule) can cancel exactly its
// own notifications via cancelScheduledNotificationAsync — never a blanket
// cancelAllScheduledNotificationsAsync, which would also wipe out any other
// feature that schedules its own local notifications later.
const ID_PREFIX = 'vervein-session-reminder-';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// Fallback only — see getPersonalizedReminderHour below, which this constant
// backs off to until there's enough real check-in history to trust instead.
const DEFAULT_REMINDER_HOUR = 8;
const REMINDER_MINUTE = 0;
// Below this many real, live check-ins (see SessionHistoryEntry's own
// checkedInAtHour doc comment), a "personalized" hour would just be fitting
// noise from 1–2 data points — same "don't invent precision the evidence
// doesn't support" rule this engine already applies everywhere else.
const MIN_SAMPLES_FOR_PERSONALIZED_HOUR = 3;
// How many of the most recent real check-ins to consider — recent enough to
// reflect a real schedule change (a new job, a new routine) within a couple
// weeks, not locked to a pattern from months ago.
const PERSONALIZED_HOUR_SAMPLE_SIZE = 10;

/**
 * The median local hour across the most recent real, live check-ins — median
 * rather than mean so one outlier (a single late-night catch-up session)
 * doesn't drag an otherwise-consistent morning pattern toward the middle of
 * the day. Falls back to DEFAULT_REMINDER_HOUR honestly whenever there isn't
 * enough real evidence yet, rather than computing a "personalized" hour from
 * a sample too small to mean anything.
 */
async function getPersonalizedReminderHour(): Promise<number> {
  // getSessionHistory() sorts newest-first, so the first N here (not the
  // last N) are the most recent real check-ins.
  const history = await getSessionHistory();
  const hours = history
    .map((entry) => entry.checkedInAtHour)
    .filter((hour): hour is number => hour !== undefined)
    .slice(0, PERSONALIZED_HOUR_SAMPLE_SIZE);
  if (hours.length < MIN_SAMPLES_FOR_PERSONALIZED_HOUR) return DEFAULT_REMINDER_HOUR;
  const sorted = [...hours].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
// BUG-FIX CONTEXT (Vervein addition, replacing the old fixed-copy design):
// a scheduled local notification's title/body is frozen the moment it's
// scheduled — there's no server here to compute fresh content right before
// delivery. The old design worked around that by never trying: one
// permanently-repeating WEEKLY trigger per training day, forever showing
// the same generic "Whenever works today" line. This instead reschedules a
// rolling window of single-fire DATE triggers every time the app comes to
// the foreground (throttled to once per real day — see
// refreshSessionReminders), each carrying whatever the engine's real
// recency/debt signal says AT THAT MOMENT. 14 days keeps iOS's 64-scheduled-
// notification ceiling comfortably clear even for a 7-day/week schedule,
// while still covering two real weeks ahead — freshness is bounded by how
// often the app is actually opened, same honest limitation session-
// reminders always had, just with a narrower staleness window instead of
// "forever until manually toggled."
const RESCHEDULE_WINDOW_DAYS = 14;

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
 * Real content for whichever day is about to be (re)scheduled — reads the
 * exact same engine signal plan-preview.ts's own body-area reorder already
 * uses (training-state.ts's getMostNeglectedBodyArea), so this reminder can
 * never name a cause the plan itself wouldn't also stand behind. Silent
 * fallback to the old generic line whenever the signal doesn't have enough
 * real evidence yet — same tiered-honesty rule as everywhere else this
 * engine surfaces a claim.
 */
async function buildReminderContent(): Promise<{ title: string; body: string }> {
  const trainingState = await getTrainingState();
  const area = getMostNeglectedBodyArea(trainingState);
  if (area) {
    return {
      title: 'Training day',
      body: `${BODY_AREA_PRIORITY_LABEL[area]} has fallen behind the rest lately.`,
    };
  }
  return { title: 'Training day', body: 'Whenever works today.' };
}

/**
 * Cancels every existing reminder and schedules a fresh rolling window of
 * single-fire DATE triggers, one per real scheduled training day over the
 * next RESCHEDULE_WINDOW_DAYS, all carrying the SAME content computed once
 * here — a real, current read, not stale content frozen days ago. The fire
 * hour is personalized per getPersonalizedReminderHour (falling back to
 * DEFAULT_REMINDER_HOUR without enough history), computed once per
 * reschedule rather than per day — a mid-window schedule change would be a
 * strange, inconsistent experience within the same rolling window. Today's
 * own slot is skipped once that hour has already passed, so this can never
 * schedule a notification that would fire immediately.
 */
async function scheduleRollingWindow(
  Notifications: typeof import('expo-notifications'),
  scheduledDays: string[]
): Promise<void> {
  const scheduledSet = new Set(scheduledDays);
  await cancelAllReminders(Notifications);
  if (scheduledSet.size === 0) return;

  const content = await buildReminderContent();
  const reminderHour = await getPersonalizedReminderHour();
  const now = new Date();
  const scheduleOps: Promise<unknown>[] = [];
  for (let offset = 0; offset < RESCHEDULE_WINDOW_DAYS; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const weekday = WEEKDAY_NAMES[day.getDay()];
    if (!scheduledSet.has(weekday)) continue;

    const fireDate = new Date(day);
    fireDate.setHours(reminderHour, REMINDER_MINUTE, 0, 0);
    if (fireDate.getTime() <= now.getTime()) continue; // today's own slot already passed — never fire immediately

    scheduleOps.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${localDateStr(fireDate)}`,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
      })
    );
  }
  // BUG FIX: Promise.all rejects the instant the FIRST op fails but doesn't
  // wait for the rest to settle — they keep running in the background,
  // unobserved. That left two real problems: this function could return
  // control to its caller (who reacts by not writing the throttle stamp,
  // triggering a retry) while some of these scheduleNotificationAsync calls
  // were STILL in flight; and a retry's own cancelAllReminders() at the top
  // of the next call could run before a straggler from THIS attempt finishes
  // scheduling, leaving that straggler uncancelled. allSettled guarantees
  // every op has actually finished (success or failure) before this function
  // returns either way, so a retry's cancel step can never race a still-
  // pending schedule call from the attempt it's replacing. Throwing when
  // anything failed preserves the existing behavior callers already rely on
  // (refreshSessionReminders's catch skips the throttle stamp, so the next
  // foreground open retries the full window) — this only closes the timing
  // gap, not the retry contract itself.
  const results = await Promise.allSettled(scheduleOps);
  const failedCount = results.filter((r) => r.status === 'rejected').length;
  if (failedCount > 0) {
    throw new Error(`scheduleRollingWindow: ${failedCount} of ${results.length} notification(s) failed to schedule.`);
  }
}

/**
 * Requests OS permission (only ever called from the user's own explicit
 * Settings toggle — never on app launch or any other unprompted path) and,
 * if granted, schedules the real rolling window (see scheduleRollingWindow).
 * Same neutral, no-guilt register as momentum.ts's own copy — no streak
 * framing, no "keep it going," and never fires for a day that isn't
 * actually scheduled. Returns false (and schedules nothing) if permission
 * was denied OR if the native module genuinely isn't available in this
 * build (Expo Go, or a stale dev-client) — the caller is responsible for
 * reverting its own toggle UI in either case; it can't tell the two apart,
 * which is fine, since the toggle already gates on availability separately
 * (see isReminderPermissionGranted / Settings' own healthKitAvailable-style
 * check).
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

    await scheduleRollingWindow(Notifications, scheduledDays);
  } catch {
    return false;
  }

  try {
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    // An explicit enable (or a schedule change via adjust-plan-sheet.tsx)
    // always reschedules for real, right now — resetting this throttle
    // stamp means the very next foreground refresh doesn't skip a
    // legitimately-due reschedule just because "today" already matches.
    await AsyncStorage.setItem(LAST_RESCHEDULED_KEY, localDateStr());
  } catch {
    // Worst case the preference doesn't persist across an app restart —
    // the notifications themselves are already scheduled either way.
  }
  return true;
}

/**
 * The foreground-refresh half of the fix — call once on cold start and
 * again on every return to foreground (see _layout.tsx's own AppState
 * listener). No-ops entirely unless reminders are actually turned on, and
 * throttled to once per real calendar day so multiple opens in the same day
 * don't churn cancel/reschedule work pointlessly. Reads the profile itself
 * (unlike enableSessionReminders, which is always called from a screen that
 * already has `days` on hand) since this has no natural caller-supplied
 * schedule — it runs from the app root, not a specific settings screen.
 */
export async function refreshSessionReminders(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  if (!(await isReminderEnabled())) return;

  const today = localDateStr();
  try {
    const last = await AsyncStorage.getItem(LAST_RESCHEDULED_KEY);
    if (last === today) return;
  } catch {
    // Storage read failed — fall through and reschedule anyway rather than
    // silently going stale.
  }

  const profile = await getProfile();
  const scheduledDays = profile?.days ? profile.days.split(',') : [];
  try {
    await scheduleRollingWindow(Notifications, scheduledDays);
    // BUG FIX: re-check enabled state AFTER the async reschedule work, not
    // just before it. Without this, disabling reminders (Settings' toggle)
    // while this exact refresh was already in flight — e.g. backgrounding
    // the app right after tapping the toggle off, then resuming fast enough
    // to fire this same refresh again — could read `enabled` as true at the
    // top of this function, then have scheduleRollingWindow finish AFTER
    // disableSessionReminders' own cancelAllReminders already ran, silently
    // re-scheduling everything the user just turned off. If it turned off
    // while this was running, undo what was just scheduled instead of
    // leaving it in place until the next foreground event corrects it.
    if (!(await isReminderEnabled())) {
      await cancelAllReminders(Notifications);
      return;
    }
    await AsyncStorage.setItem(LAST_RESCHEDULED_KEY, today);
  } catch {
    // Worst case this refresh silently didn't happen — the next foreground
    // open tries again since the throttle stamp was never written.
  }
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
    // Cleared so a later re-enable's first refresh isn't skipped by a stale
    // throttle stamp from before reminders were turned off.
    await AsyncStorage.removeItem(LAST_RESCHEDULED_KEY);
  } catch {
    // Worst case the preference doesn't persist — the real cancellation
    // above already happened regardless.
  }
}
