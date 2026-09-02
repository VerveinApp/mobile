import AsyncStorage from '@react-native-async-storage/async-storage';

const CHECKIN_COUNT_KEY = 'vervein.paywallCheckinCount.v1';
const SHOWN_KEY = 'vervein.paywallShown.v1';

// Vervein-chosen UX threshold, not a business number — when to first show
// VerveIn Plus. Same status as coaching-insights.ts's MIN_OCCURRENCES: a
// timing constant, not something requiring founder sign-off. Three real
// check-ins is enough for someone to have felt the plan actually adapt
// (energy → different session, at least once) before asking them to pay for
// more of it.
const PAYWALL_TRIGGER_CHECKIN_COUNT = 3;

/**
 * A dedicated counter, separate from session-history.ts's entries — that log
 * also includes retroactively-logged past sessions ("Log a Past Session" in
 * Progress & History), which shouldn't count toward "used the real check-in
 * flow N times." This increments only from the one real place someone
 * actually taps "Start session" (see check-in.tsx's handleStartSession).
 *
 * Fires exactly once, the moment the count reaches the trigger — never
 * again after, even if dismissed without subscribing (SHOWN_KEY latches
 * permanently, not a cooldown like coaching-insights.ts's). Someone who
 * wants to see it again can still reach VerveIn Plus from Settings; this is
 * a one-time "you've felt the value, here's the option" moment, not a
 * repeating nag.
 */
export async function recordCheckInAndShouldShowPaywall(): Promise<boolean> {
  try {
    const [countRaw, alreadyShown] = await Promise.all([
      AsyncStorage.getItem(CHECKIN_COUNT_KEY),
      AsyncStorage.getItem(SHOWN_KEY),
    ]);
    const nextCount = (countRaw ? parseInt(countRaw, 10) : 0) + 1;
    await AsyncStorage.setItem(CHECKIN_COUNT_KEY, String(nextCount));
    if (alreadyShown === 'true' || nextCount !== PAYWALL_TRIGGER_CHECKIN_COUNT) return false;
    await AsyncStorage.setItem(SHOWN_KEY, 'true');
    return true;
  } catch {
    // Worst case the prompt never fires automatically — Settings' own
    // VerveIn Plus row is still reachable manually, so this is never the
    // only path to it.
    return false;
  }
}
