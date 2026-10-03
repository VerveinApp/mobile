import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getMostNeglectedBodyArea } from '@/lib/engine/training-state';
import { localDateStr } from '@/lib/local-date';
import { BODY_AREA_PRIORITY_LABEL } from '@/lib/plan-preview';
import { WEEKDAY_NAMES } from '@/lib/profile-labels';
import { getSessionHistory } from '@/lib/session-history';
import { getTodaySession } from '@/lib/today-session';
import { getTrainingState } from '@/lib/training-state-loader';
import { getProfile } from '@/lib/user-profile';

const ENABLED_KEY = 'vervein.remindersEnabled.v1';
const LAST_RESCHEDULED_KEY = 'vervein.remindersLastRescheduled.v1';
// Set the one time the post-session "want a nudge on training days?" offer
// is shown (see shouldOfferReminderPrompt) — a single contextual ask, never
// a repeating nag. Settings' own toggle stays available either way.
const PROMPT_OFFERED_KEY = 'vervein.reminderPromptOffered.v1';
// Every reminder this module schedules carries this identifier prefix, so
// disabling (or re-enabling with a changed schedule) can cancel exactly its
// own notifications via cancelScheduledNotificationAsync — never a blanket
// cancelAllScheduledNotificationsAsync, which would also wipe out any other
// feature that schedules its own local notifications later.
const ID_PREFIX = 'vervein-session-reminder-';

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
// Exported so other modules needing expo-notifications (e.g.
// push-notifications.ts, for a real Expo push token instead of a local
// schedule) reuse this exact lazy-require, instead of each reimplementing
// the same fix and risking a subtly different — and untested — version of
// it. See this function's own comment above for why it must stay a
// synchronous require(), not a dynamic import().
let cachedModule: typeof import('expo-notifications') | null | undefined;
export function getModule(): typeof import('expo-notifications') | null {
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
 *
 * BUG FIX: this used to read "X has fallen behind the rest lately" — debt/
 * guilt framing landing as an unprompted push notification, arguably the
 * worst place for it (an interruption telling someone they're behind,
 * not just an in-app line they can shrug past). Same fix as plan-preview.ts's
 * own matching sentence: a body area with a long real recency gap is
 * well-rested, not neglected — same signal, readiness framing instead of a
 * ledger of what's owed. States the fact, never a command to go train it.
 */
// BUG FIX (user's own real device screenshot: the exact same "Whenever
// works today." fired two days running): one fixed string per case reads as
// a bot the moment someone notices the repeat, even though the underlying
// signal is real each time. A random pick per (re)schedule — see
// buildReminderContent below — fixes the repetition without touching what
// the notification is actually allowed to claim. Every line here stays in
// the same readiness framing as the original two (see this function's own
// doc comment above): no "overdue"/"behind"/"neglected" wording sneaking
// back in through a new variant.
const AREA_READY_TEMPLATES: ((label: string) => string)[] = [
  (label) => `${label} is well-rested and ready.`,
  (label) => `${label} is fresh — good day for it.`,
  (label) => `${label}'s had time to recover. Ready when you are.`,
  (label) => `A good day for ${label}, whenever it fits.`,
];
const GENERIC_TEMPLATES: string[] = [
  'Whenever works today.',
  'No rush — just whenever fits.',
  "Today's open. Train whenever works.",
  'Just a nudge — no specific reason today.',
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// A reminder is about today's session, so tapping one opens today's check-in
// (see notification-redirect.ts) rather than wherever the app last was.
const REMINDER_DATA = { url: '/home/check-in' };

async function buildReminderContent(): Promise<{ title: string; body: string; data: { url: string } }> {
  const trainingState = await getTrainingState();
  const area = getMostNeglectedBodyArea(trainingState);
  if (area) {
    return {
      title: 'Training day',
      body: pickRandom(AREA_READY_TEMPLATES)(BODY_AREA_PRIORITY_LABEL[area]),
      data: REMINDER_DATA,
    };
  }
  return { title: 'Training day', body: pickRandom(GENERIC_TEMPLATES), data: REMINDER_DATA };
}

// BUG FIX: scheduleRollingWindow's own cancel-then-reschedule sequence had
// no mutual exclusion between callers — enableSessionReminders (a schedule
// change from adjust-plan-sheet.tsx) and refreshSessionReminders (an
// AppState foreground event) can both call it, and neither waited for the
// other. Two calls landing close together (e.g. backgrounding the app right
// after saving a schedule change, then foregrounding fast enough to fire a
// refresh before the first call's own awaits settle) could interleave: A
// cancels, B cancels (nothing left to cancel), A schedules its window, B's
// own schedule call then either duplicates A's work or — if B's
// getProfile() read raced in before the schedule change's updateProfile had
// actually committed — silently reschedules the OLD days back on top of
// the new ones the person just saved, with no error and no visible sign
// anything went wrong. Chaining every real call onto this shared promise
// serializes them: each one's full cancel+reschedule sequence finishes
// before the next one's even starts, so whichever call is genuinely last
// always wins cleanly instead of tearing an in-flight one.
let schedulingChain: Promise<void> = Promise.resolve();

/**
 * Generic version of the same chaining primitive scheduleRollingWindow
 * already used only for itself — queues arbitrary work onto the shared
 * chain and returns that specific call's own promise (so its caller's own
 * try/catch still sees a real rejection), while the shared chain variable
 * itself always resolves to a no-op so one failure can't permanently wedge
 * every future caller behind it.
 */
function runChained<T>(work: () => Promise<T>): Promise<T> {
  const run = schedulingChain.then(work);
  schedulingChain = run.then(
    () => {},
    () => {}
  );
  return run;
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
function scheduleRollingWindow(
  Notifications: typeof import('expo-notifications'),
  scheduledDays: string[]
): Promise<void> {
  return runChained(() => scheduleRollingWindowInner(Notifications, scheduledDays));
}

async function scheduleRollingWindowInner(
  Notifications: typeof import('expo-notifications'),
  scheduledDays: string[]
): Promise<void> {
  const scheduledSet = new Set(scheduledDays);
  await cancelAllReminders(Notifications);
  if (scheduledSet.size === 0) return;

  const content = await buildReminderContent();
  const reminderHour = await getPersonalizedReminderHour();
  // BUG FIX: today's slot used to be scheduled even after today's check-in
  // already happened — someone who trained at 7am still got a "Training
  // day" nudge at their usual 6pm. A today-session existing at all means
  // they've already shown up today, so there's nothing left to remind.
  const checkedInToday = (await getTodaySession()) !== null;
  const now = new Date();
  const scheduleOps: Promise<unknown>[] = [];
  for (let offset = 0; offset < RESCHEDULE_WINDOW_DAYS; offset++) {
    if (offset === 0 && checkedInToday) continue;
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

    // BUG FIX: the reschedule and the ENABLED_KEY write used to be two
    // separate steps — only the reschedule itself went through
    // schedulingChain, so a concurrent disableSessionReminders (which used
    // to write its own key directly, unchained) could land in between:
    // this reschedule finishes, disable's cancellation+false-write happens,
    // then this function's own unconditional 'true' write below silently
    // stomped it back on — leaving reminders live-scheduled even though the
    // user's real last action was turning them off. Bundling both steps
    // into one chained unit with disableSessionReminders' own equivalent
    // unit means whichever call was actually issued last is the one whose
    // effects (both the real notifications AND the stored preference)
    // persist, matching real user intent instead of racing.
    await runChained(async () => {
      await scheduleRollingWindowInner(Notifications, scheduledDays);
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
    });
  } catch {
    return false;
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

// BUG FIX: this used to call cancelAllReminders directly, entirely outside
// schedulingChain, while enableSessionReminders/refreshSessionReminders both
// route their own work through it specifically to serialize against each
// other. That left this one call free to interleave with either: a disable
// landing while an enable's own reschedule was mid-flight could finish its
// cancellation before that reschedule (and enable's own unconditional
// 'true' write) completed, silently leaving reminders live-scheduled with
// ENABLED_KEY back to 'true' even though the user's real last action was
// turning them off. Bundled into one chained unit, same as enable's own
// fix, so whichever call was actually issued last — not whichever happened
// to finish its own unchained work first — is the one that sticks.
export async function disableSessionReminders(): Promise<void> {
  const Notifications = getModule();
  await runChained(async () => {
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
  });
}

/**
 * Cancels just today's already-scheduled reminder — called the moment a
 * check-in starts (see check-in.tsx's handleStartSession). The daily
 * reschedule throttle means today's slot could otherwise still be pending
 * from a refresh that ran earlier the same day, before the check-in existed;
 * scheduleRollingWindowInner's own checkedInToday skip covers every later
 * reschedule. Chained like every other scheduling operation here so it can't
 * interleave with a reschedule that's mid-flight.
 */
export async function cancelTodaysReminder(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  await runChained(async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(`${ID_PREFIX}${localDateStr()}`);
    } catch {
      // Nothing scheduled for today (or already fired) — nothing to cancel.
    }
  });
}

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * The OS-level permission state, read without ever prompting. 'granted'
 * includes iOS provisional authorization (quiet delivery the user can later
 * upgrade from Notification Center) — see the SDK 57 docs' own guidance to
 * read ios.status rather than the root fields alone.
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const Notifications = getModule();
  if (!Notifications) return 'unsupported';
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (
      permissions.granted ||
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'granted';
    }
    return permissions.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * Whether the post-session "want a nudge on your training days?" line
 * should show: reminders aren't already on, the OS prompt has genuinely
 * never been answered (asking again after a "Don't Allow" is impossible
 * anyway), there are real training days to remind about, and this offer
 * hasn't been made before. This replaces the old cold-launch permission
 * prompt, which fired over the Welcome screen before anyone knew what the
 * app was — a reflexive "Don't Allow" there disabled reminders for good.
 */
export async function shouldOfferReminderPrompt(scheduledDays: string[]): Promise<boolean> {
  if (scheduledDays.length === 0) return false;
  if (await isReminderEnabled()) return false;
  try {
    if ((await AsyncStorage.getItem(PROMPT_OFFERED_KEY)) === 'true') return false;
  } catch {
    return false;
  }
  return (await getNotificationPermissionState()) === 'undetermined';
}

export async function markReminderPromptOffered(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPT_OFFERED_KEY, 'true');
  } catch {
    // Worst case the offer can show once more — never a crash.
  }
}
