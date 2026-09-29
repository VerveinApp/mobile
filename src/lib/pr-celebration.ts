import type { RecordPerformanceResult } from '@/lib/exercise-performance';
import { getLoadImprovementNote } from '@/lib/momentum';

// An hour, not immediate — check-in.tsx's own "done" screen already shows
// this exact fact the instant a session finishes (momentum.ts's own
// getLoadImprovementNote, reused below for identical wording). A push
// notification firing at that same moment would just be a louder copy of
// something already on screen. Landing an hour later instead turns it into
// a second, distinct touchpoint — the kind of moment that pulls someone
// back to the app after they've already put their phone down, rather than
// a mid-set gamified ding piled onto a screen they're already looking at.
const CELEBRATION_DELAY_MS = 60 * 60 * 1000;

// Same lazy, function-scoped require() as session-reminders.ts's own
// getModule — see that file's disclosed fix-history comment for why this
// specific loading mechanism (not a top-level or dynamic import) is what
// actually catches expo-notifications' native-module-missing error in
// Expo Go / a stale dev-client.
let cachedModule: typeof import('expo-notifications') | null | undefined;
function getModule(): typeof import('expo-notifications') | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see session-reminders.ts's own getModule for why this must be require(), not import().
    cachedModule = require('expo-notifications');
  } catch {
    cachedModule = null;
  }
  return cachedModule ?? null;
}

/**
 * Schedules a single delayed local notification naming the session's
 * single biggest strength jump — check-in.tsx's finish-session handler is
 * the one real caller, right where recordPerformanceBatch's own results
 * are already on hand. No-ops entirely (schedules nothing) when nothing
 * this session actually improved, matching getLoadImprovementNote's own
 * "one real moment, not a report" contract.
 *
 * Never requests notification permission itself — session-reminders.ts's
 * enableSessionReminders is the one place that's allowed to, and only from
 * the user's own explicit Settings toggle. This only checks whatever
 * permission state already exists and silently does nothing without it, so
 * a session finishing never itself triggers an unprompted OS permission
 * dialog.
 */
export async function schedulePrCelebration(
  results: { exerciseName: string; result: RecordPerformanceResult }[]
): Promise<void> {
  const note = getLoadImprovementNote(results);
  if (!note) return;
  const Notifications = getModule();
  if (!Notifications) return;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    const fireDate = new Date(Date.now() + CELEBRATION_DELAY_MS);
    await Notifications.scheduleNotificationAsync({
      identifier: `vervein-pr-celebration-${fireDate.getTime()}`,
      content: { title: 'Nice work today', body: note },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
  } catch {
    // Best-effort, same as every other local notification in this app —
    // a missed celebration notification isn't worth surfacing an error for.
  }
}
