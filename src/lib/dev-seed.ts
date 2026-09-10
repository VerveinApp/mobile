/**
 * ⚠️ DEV-ONLY — powers the "Seed fake session history" button in Settings'
 * Developer section (see that file's own header for the whole-section
 * removal reminder before a real App Store submission). Backfills a few
 * weeks of realistic completed/partial/skipped days onto this device's real
 * scheduled weekdays, so Progress's consistency calendar, Training Balance,
 * and Training Load can all be visually checked without actually training
 * for weeks. Never touches anything a real user's build would reach —
 * nothing here is wired into any non-Settings screen.
 *
 * Writes through the same real functions the live app uses
 * (recordPastSessionCompletion, saveRetroactiveWorkoutLog), body-area-level
 * exercise names matching the exact convention Progress & History's own
 * "Log a Past Session" flow already uses (log-past-session-sheet.tsx) —
 * this is a faster way to produce the same honest shape of data a real
 * person backfilling several days by hand would leave behind, not a
 * different, less-real kind of record.
 */

import { BODY_AREA_LABELS, BODY_AREA_ORDER } from '@/lib/body-area-labels';
import { recordPerformance } from '@/lib/exercise-performance';
import { localDateStr } from '@/lib/local-date';
import { backdateAccountStartDateForTesting } from '@/lib/onboarding-draft';
import type { BodyArea } from '@/lib/plan-preview';
import { WEEKDAY_NAMES } from '@/lib/profile-labels';
import { recordPastSessionCompletion } from '@/lib/session-history';
import { getProfile } from '@/lib/user-profile';
import { saveRetroactiveWorkoutLog, type WorkoutLogExercise } from '@/lib/workout-log';

const WEEKS_TO_SEED = 4;

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

/**
 * Deterministic-enough spread (not a real RNG — no seed to control, and this
 * never needs to be reproduced exactly) across done/partial/skipped, biased
 * toward done so the calendar reads as a real, mostly-consistent account
 * rather than a coin flip — a plausible history, not a stress test.
 */
function pickOutcome(index: number): 'done' | 'partial' | 'skipped' {
  const roll = (index * 37) % 10;
  if (roll < 6) return 'done';
  if (roll < 8) return 'partial';
  return 'skipped';
}

/**
 * BUG FIX: this used to be BODY_AREA_ORDER.slice(0, count) — always slicing
 * from the front of a fixed ['upper','lower','core','full'] array, so a
 * count of 2 or 3 could only ever produce 'upper'/'lower'(/'core') and
 * 'full' (index 3) was structurally unreachable no matter how many sessions
 * got seeded. Rotating the starting index by the session's own position
 * means every area, full body included, eventually gets covered across a
 * few weeks of seeded sessions.
 */
function pickAreasForSession(index: number, count: number): BodyArea[] {
  return Array.from({ length: count }, (_, i) => BODY_AREA_ORDER[(index + i) % BODY_AREA_ORDER.length]);
}

/**
 * Backfills WEEKS_TO_SEED weeks of history onto this device's own real
 * scheduled weekdays (profile.days) — never invents a schedule the account
 * doesn't already have. No-ops (returns false) if no schedule exists yet,
 * since there'd be nothing honest to seed against.
 */
export async function seedFakeSessionHistory(): Promise<boolean> {
  const profile = await getProfile();
  const scheduledDays = profile?.days ? profile.days.split(',') : null;
  if (!scheduledDays || scheduledDays.length === 0) return false;

  const today = new Date();
  const totalDays = WEEKS_TO_SEED * 7;
  const earliestDate = localDateStr(addDays(today, -(totalDays - 1)));
  await backdateAccountStartDateForTesting(earliestDate);

  let scheduledIndex = 0;
  for (let offset = totalDays - 1; offset >= 1; offset--) {
    const date = addDays(today, -offset);
    const weekday = WEEKDAY_NAMES[date.getDay()];
    if (!scheduledDays.includes(weekday)) continue;
    const dateStr = localDateStr(date);

    const outcome = pickOutcome(scheduledIndex);
    scheduledIndex += 1;

    if (outcome === 'skipped') {
      await recordPastSessionCompletion(dateStr, false, 3, 'skipped');
      continue;
    }

    const areaCount = outcome === 'done' ? 2 + (scheduledIndex % 2) : 1;
    const areasHit = pickAreasForSession(scheduledIndex, areaCount);
    const exercises: WorkoutLogExercise[] = areasHit.map((area, i) => ({
      name: BODY_AREA_LABELS[area],
      bodyArea: area,
      completed: outcome === 'done' || i === 0,
    }));

    await recordPastSessionCompletion(dateStr, true, 3, outcome);
    await saveRetroactiveWorkoutLog(dateStr, exercises);
  }

  return true;
}

// Real library exercise names (see engine/data/exercise-library.json) —
// exercise-performance.ts is keyed by whatever name a real session logs
// against, so using actual library names here matches what real data would
// look like, not a fabricated-looking placeholder.
const STRENGTH_MOCK_LIFTS: { name: string; baselineKg: number; improvedKg: number; reps: number }[] = [
  { name: 'Barbell Back Squat', baselineKg: 60, improvedKg: 70, reps: 8 },
  { name: 'Flat Barbell Bench Press', baselineKg: 40, improvedKg: 45, reps: 8 },
  { name: 'Conventional Deadlift (Barbell)', baselineKg: 80, improvedKg: 90, reps: 5 },
];

/**
 * Logs a baseline then an improved rep for each mock lift — recordPerformance
 * only ever compares against whatever was logged immediately before it, so
 * this is two real writes per exercise, not one record with a fabricated
 * "improved" flag. Populates Progress's "Strength Progress" section (and its
 * relative-strength line, once the profile has a weight on file) the same
 * honest way a person logging weights across two real sessions would.
 */
export async function seedFakeStrengthProgress(): Promise<void> {
  for (const lift of STRENGTH_MOCK_LIFTS) {
    await recordPerformance(lift.name, lift.baselineKg, lift.reps);
    await recordPerformance(lift.name, lift.improvedKg, lift.reps);
  }
}
