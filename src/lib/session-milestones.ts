import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNT_KEY = 'vervein.lifetimeSessionCount.v1';
const SHOWN_KEY = 'vervein.milestonesShown.v1';

/**
 * A cumulative lifetime total, not a streak — it only ever goes up, and a
 * missed day (or a month away) can never "break" it. That's the real
 * distinction the research vault's Anti-Roadmap draws: it bans a streak
 * counter specifically for punishing the target user on their worst days
 * (see momentum.ts's own doc comment); a number that can't go down doesn't
 * carry that risk. session-history.ts's own entries are capped at the last
 * 30 (a deliberate rolling window for the weekly view, not a lifetime
 * ledger), so a real "Nth session" milestone needs its own dedicated,
 * uncapped counter rather than trying to count that array.
 */
const MILESTONES = [1, 10, 25, 50, 100, 250, 500];

/**
 * Call exactly once per real session finish (done or partial — never a
 * skipped one, so opening the app or abandoning a session can't inflate the
 * count). Returns the milestone number the instant it's newly reached, or
 * null otherwise — including if it's already been shown once before, so a
 * caller can safely call this without separately tracking "have I shown
 * this already." Never called from a reopen/reload path — see
 * check-in.tsx's own note on why re-deriving this on reopen would be wrong
 * (unlike postSessionNote, this isn't a pure function of stored state; it
 * mutates a counter, so it can only ever fire once, at the real moment).
 */
export async function recordSessionForMilestones(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(COUNT_KEY);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(next));
    if (!MILESTONES.includes(next)) return null;

    const shownRaw = await AsyncStorage.getItem(SHOWN_KEY);
    const shown: number[] = shownRaw ? JSON.parse(shownRaw) : [];
    if (shown.includes(next)) return null;
    await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, next]));
    return next;
  } catch {
    // Worst case: no celebration this time, and the count itself may not
    // have persisted — never a crash, and never a wrong/guessed number.
    return null;
  }
}

/** Raw read of the lifetime total — data-backup.ts's export path (and any
 * future "N sessions all-time" display) only; the live milestone-detection
 * flow above never needs this, since it tracks the increment itself. */
export async function getLifetimeSessionCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(COUNT_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

/** Raw read of which milestone numbers have already been celebrated —
 * data-backup.ts's export path only. */
export async function getShownMilestones(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

/** Overwrites both the counter and the shown-milestones list wholesale —
 * data-backup.ts's restore path only. Restoring `shown` alongside `count`
 * (not just count alone) matters: without it, a restored count that's
 * already past a milestone threshold would let that milestone fire again
 * on the very next real session, re-celebrating something the user already
 * saw before their backup was taken. */
export async function restoreMilestones(count: number, shown: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(COUNT_KEY, String(count));
    await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
  } catch {
    // Worst case this one field doesn't restore — the rest of the backup still applies independently.
  }
}

/** Wipes both the lifetime counter and the shown-milestones list —
 * Settings' "Delete My Data"/"Delete Account" flows only. Same disclosed
 * gap as workout-log.ts's clearWorkoutLog: this store postdates
 * handleDeleteData's original clear-list. */
export async function clearMilestones() {
  try {
    await AsyncStorage.removeItem(COUNT_KEY);
    await AsyncStorage.removeItem(SHOWN_KEY);
  } catch {
    // Best-effort — same as never having logged a session.
  }
}
