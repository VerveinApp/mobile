import { clearStoredValue, readJsonList, readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

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
  const next = (await readJsonValue<number>(COUNT_KEY, 0)) + 1;
  await writeJsonValue(COUNT_KEY, next);
  if (!MILESTONES.includes(next)) return null;

  const shown = await readJsonList<number>(SHOWN_KEY);
  if (shown.includes(next)) return null;
  await writeJsonValue(SHOWN_KEY, [...shown, next]);
  return next;
}

/** Raw read of the lifetime total — data-backup.ts's export path (and any
 * future "N sessions all-time" display) only; the live milestone-detection
 * flow above never needs this, since it tracks the increment itself. */
export async function getLifetimeSessionCount(): Promise<number> {
  return readJsonValue<number>(COUNT_KEY, 0);
}

/** Raw read of which milestone numbers have already been celebrated —
 * data-backup.ts's export path only. */
export async function getShownMilestones(): Promise<number[]> {
  return readJsonList<number>(SHOWN_KEY);
}

/** Overwrites both the counter and the shown-milestones list wholesale —
 * data-backup.ts's restore path only. Restoring `shown` alongside `count`
 * (not just count alone) matters: without it, a restored count that's
 * already past a milestone threshold would let that milestone fire again
 * on the very next real session, re-celebrating something the user already
 * saw before their backup was taken. */
export async function restoreMilestones(count: number, shown: number[]): Promise<void> {
  await writeJsonValue(COUNT_KEY, count);
  await writeJsonValue(SHOWN_KEY, shown);
}

/** Wipes both the lifetime counter and the shown-milestones list —
 * Settings' "Delete My Data"/"Delete Account" flows only. Same disclosed
 * gap as workout-log.ts's clearWorkoutLog: this store postdates
 * handleDeleteData's original clear-list. */
export async function clearMilestones() {
  await clearStoredValue(COUNT_KEY);
  await clearStoredValue(SHOWN_KEY);
}
