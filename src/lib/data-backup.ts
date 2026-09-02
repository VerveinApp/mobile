import {
  clearBodyMeasurements,
  getBodyMeasurements,
  restoreBodyMeasurements,
  type BodyMeasurementEntry,
} from '@/lib/body-measurements';
import { clearCalibration, getCalibration, restoreCalibration } from '@/lib/calibration';
import {
  clearConditionLog,
  getConditionLog,
  restoreConditionLog,
  type ConditionLogEntry,
} from '@/lib/condition-log';
import { clearCheckInHistory, getLastCheckIn, restoreLastCheckIn, type CheckInRecord } from '@/lib/check-in-history';
import {
  clearDecisionTraceLog,
  getDecisionTraceLog,
  restoreDecisionTraceLog,
  type StoredTrace,
} from '@/lib/decision-trace-log';
import type { UserCalibration } from '@/lib/engine/types';
import {
  clearExercisePerformance,
  getAllExercisePerformances,
  restoreExercisePerformance,
  type ExercisePerformance,
} from '@/lib/exercise-performance';
import { clearNotes, getNotes, restoreNotes, type NoteEntry } from '@/lib/notes';
import { clearOnboardingCompleted, clearOnboardingDraft } from '@/lib/onboarding-draft';
import { clearProgressPhotos } from '@/lib/progress-photos';
import { disableSessionReminders } from '@/lib/session-reminders';
import {
  clearMilestones,
  getLifetimeSessionCount,
  getShownMilestones,
  restoreMilestones,
} from '@/lib/session-milestones';
import { clearSessionHistory, getSessionHistory, restoreSessionHistory, type SessionHistoryEntry } from '@/lib/session-history';
import { clearTodaySession } from '@/lib/today-session';
import { clearProfile, getProfile, saveProfile, type UserProfile } from '@/lib/user-profile';
import { clearWorkoutLog, getAllWorkoutLogs, restoreWorkoutLog, type WorkoutLogEntry } from '@/lib/workout-log';
import { clearWeightLog, getWeightLog, restoreWeightLog, type WeightLogEntry } from '@/lib/weight-log';

// The whole point of this module: Settings' Export My Data action (see
// settings/index.tsx's handleExport) produced real JSON, but nothing ever
// read it back in — a one-way dead end that only *looked* like a backup.
// Everything gathered here is real user data someone would grieve losing on
// a reinstall or new phone: profile, the learned calibration multiplier,
// every history log, and the lifetime session-milestone counter.
//
// Deliberately excluded, on purpose, not by oversight: device-local
// settings and OS-granted permissions (theme, units, haptics, App Lock
// enabled, HealthKit connected, reminders enabled, onboarding-completed).
// Restoring those blindly onto a different device would be actively
// dishonest — App Lock enabled with no Face ID actually set up on the new
// phone would lock someone out; a restored "reminders enabled" flag
// wouldn't survive iOS/Android's own per-device notification permission,
// which this app already re-verifies live (see session-reminders.ts and
// Settings' own reminder-toggle load effect) rather than trusting a stored
// flag. Also excluded: today-session.ts's TodaySession — it's inherently
// scoped to "today" (getTodaySession discards anything whose date doesn't
// match locally), so restoring an old one onto a different day would just
// silently no-op; there's nothing there worth carrying across a restore.
// BUG FIX: bumped 1 → 2 alongside adding the exercisePerformance field below
// — this file's own parseBackupPayload doc comment is explicit that only an
// exact version match is accepted specifically so a payload missing a field
// a newer build expects gets a clear "different app version" error instead
// of silently restoring with that field undefined (or crashing on it).
// Bumped 2 → 3 alongside adding the notes field, same reasoning.
// Bumped 3 → 4 alongside adding the bodyMeasurements field, same reasoning
// — this store has no nav entry point yet (see body-measurements.ts's own
// header comment) but is exported/restored/cleared like every other real
// store the moment someone has an entry in it, e.g. via a future debug path.
// Bumped 4 → 5 alongside adding the conditionLog field, same reasoning as
// bodyMeasurements — no nav entry point yet either.
//
// progress-photos.ts is deliberately NOT a field here and never bumped this
// version — its whole store is actual image files, and this module's
// contract is a pasteable JSON blob (see parseBackupPayload's own doc
// comment); base64-inlining photos into that would balloon an ordinary
// export to megabytes. clearAllLocalData below still wipes it — the
// export-format gap and the delete-my-data guarantee are separate concerns.
export const BACKUP_VERSION = 5;

export type BackupPayload = {
  version: number;
  exportedAt: string;
  profile: UserProfile | null;
  calibration: UserCalibration;
  lastCheckIn: CheckInRecord | null;
  sessionHistory: SessionHistoryEntry[];
  workoutLog: WorkoutLogEntry[];
  weightLog: WeightLogEntry[];
  decisionTraceLog: StoredTrace[];
  milestones: { count: number; shown: number[] };
  // BUG FIX: this store (Progress tab's "Strength Progress" — logged
  // weight/reps/estimated-1RM per exercise) postdated this file's original
  // field list and was silently missing from export, restore, AND
  // clearAllLocalData below — the same disclosed gap pattern this file's own
  // header comment already calls out for workout-log.ts/weight-log.ts/
  // decision-trace-log.ts. See exercise-performance.ts's own clear/restore
  // functions for the matching other half of this fix.
  exercisePerformance: Record<string, ExercisePerformance>;
  notes: NoteEntry[];
  bodyMeasurements: BodyMeasurementEntry[];
  conditionLog: ConditionLogEntry[];
};

export async function buildBackupPayload(): Promise<BackupPayload> {
  const [
    profile,
    calibration,
    lastCheckIn,
    sessionHistory,
    workoutLog,
    weightLog,
    decisionTraceLog,
    count,
    shown,
    exercisePerformance,
    notes,
    bodyMeasurements,
    conditionLog,
  ] = await Promise.all([
    getProfile(),
    getCalibration(),
    getLastCheckIn(),
    getSessionHistory(),
    getAllWorkoutLogs(),
    getWeightLog(),
    getDecisionTraceLog(),
    getLifetimeSessionCount(),
    getShownMilestones(),
    getAllExercisePerformances(),
    getNotes(),
    getBodyMeasurements(),
    getConditionLog(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    calibration,
    lastCheckIn,
    sessionHistory,
    workoutLog,
    weightLog,
    decisionTraceLog,
    milestones: { count, shown },
    exercisePerformance,
    notes,
    bodyMeasurements,
    conditionLog,
  };
}

export type ParseResult = { ok: true; payload: BackupPayload } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Hand-rolled structural validation, not a schema library — matches this
 * codebase's standing "never trust external input blindly" pattern (same
 * spirit as onboarding's standing-symptom-tag rejection in baseline-plan.ts
 * throwing on an unrecognized tag rather than silently passing it through).
 * This is pasted text from a Share-exported blob, potentially edited,
 * truncated, or from a future/older app version — every field is checked
 * before anything gets written, so a malformed paste fails loudly with a
 * specific reason instead of partially restoring or crashing mid-write.
 * Only the exact current BACKUP_VERSION is accepted: a future version
 * restoring into an older app build could silently drop fields that
 * version's restore functions don't know about, which is worse than
 * refusing outright and asking the user to update first.
 */
export function parseBackupPayload(raw: string): ParseResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That doesn't look like valid backup data." };
  }
  if (!isPlainObject(candidate)) return { ok: false, error: "That doesn't look like valid backup data." };
  if (candidate.version !== BACKUP_VERSION) {
    return { ok: false, error: 'This backup is from a different app version and can’t be restored here.' };
  }
  if (typeof candidate.exportedAt !== 'string') return { ok: false, error: 'Backup is missing its export date.' };
  if (candidate.profile !== null && !isPlainObject(candidate.profile)) {
    return { ok: false, error: 'Backup profile data is malformed.' };
  }
  if (
    !isPlainObject(candidate.calibration) ||
    typeof candidate.calibration.multiplier !== 'number' ||
    typeof candidate.calibration.sampleCount !== 'number'
  ) {
    return { ok: false, error: 'Backup calibration data is malformed.' };
  }
  if (candidate.lastCheckIn !== null && !isPlainObject(candidate.lastCheckIn)) {
    return { ok: false, error: 'Backup check-in data is malformed.' };
  }
  if (!Array.isArray(candidate.sessionHistory)) return { ok: false, error: 'Backup session history is malformed.' };
  if (!Array.isArray(candidate.workoutLog)) return { ok: false, error: 'Backup workout log is malformed.' };
  if (!Array.isArray(candidate.weightLog)) return { ok: false, error: 'Backup weight log is malformed.' };
  if (!Array.isArray(candidate.decisionTraceLog)) return { ok: false, error: 'Backup training-load data is malformed.' };
  if (
    !isPlainObject(candidate.milestones) ||
    typeof candidate.milestones.count !== 'number' ||
    !Array.isArray(candidate.milestones.shown)
  ) {
    return { ok: false, error: 'Backup milestone data is malformed.' };
  }
  if (!isPlainObject(candidate.exercisePerformance)) {
    return { ok: false, error: 'Backup strength-progress data is malformed.' };
  }
  if (!Array.isArray(candidate.notes)) return { ok: false, error: 'Backup notes are malformed.' };
  if (!Array.isArray(candidate.bodyMeasurements)) {
    return { ok: false, error: 'Backup body-measurement data is malformed.' };
  }
  if (!Array.isArray(candidate.conditionLog)) return { ok: false, error: 'Backup condition-log data is malformed.' };
  return { ok: true, payload: candidate as unknown as BackupPayload };
}

/**
 * Only ever called after parseBackupPayload already validated the whole
 * shape — every write below assumes that already happened. AsyncStorage
 * isn't transactional, so this still can't guarantee true atomicity across
 * a crash mid-restore, but validating everything up front (rather than
 * validating field-by-field as each one is about to be written) is what
 * keeps a malformed payload from ever starting a partial write in the
 * first place.
 */
export async function restoreBackupPayload(payload: BackupPayload): Promise<void> {
  await Promise.all([
    payload.profile !== null ? saveProfile(payload.profile) : Promise.resolve(),
    restoreCalibration(payload.calibration),
    restoreLastCheckIn(payload.lastCheckIn),
    restoreSessionHistory(payload.sessionHistory),
    restoreWorkoutLog(payload.workoutLog),
    restoreWeightLog(payload.weightLog),
    restoreDecisionTraceLog(payload.decisionTraceLog),
    restoreMilestones(payload.milestones.count, payload.milestones.shown),
    restoreExercisePerformance(payload.exercisePerformance),
    restoreNotes(payload.notes),
    restoreBodyMeasurements(payload.bodyMeasurements),
    restoreConditionLog(payload.conditionLog),
  ]);
}

/**
 * DISCLOSED FIX: Settings' "Delete My Data" originally cleared only
 * profile/onboarding/check-in-history/today-session/session-history —
 * workout-log.ts, weight-log.ts, decision-trace-log.ts, and
 * session-milestones.ts all postdate that original clear-list and were
 * silently never added to it, so a supposed full wipe left real
 * per-exercise history, weigh-ins, training-load traces, and the lifetime
 * session counter fully intact. This is the one place that now knows
 * about every real local store, matching buildBackupPayload's own
 * "every store worth backing up" role — both should be extended together
 * whenever a new store is added.
 *
 * Same exclusions as buildBackupPayload's own doc comment (device-local
 * settings and OS-granted permissions), with one addition: scheduled
 * reminders ARE cancelled here even though they're not "data" — a stale
 * "Training day" notification continuing to fire after every real record
 * it refers to has been wiped would be actively wrong, not just an
 * inconsistency, so this calls disableSessionReminders() rather than
 * leaving it alone the way theme/units/haptics/App Lock are left alone.
 *
 * Used by both Settings' existing "Delete My Data" action and the new
 * "Delete Account" flow (settings/index.tsx) — the latter also signs out
 * of the now-deleted Supabase account afterward, which this function
 * deliberately does NOT do itself, since "Delete My Data" alone should
 * never sign a still-valid account out as a side effect.
 *
 * DISCLOSED FIX: clearCalibration was missing entirely — calibration.ts had
 * no clear function at all, despite buildBackupPayload treating it as real
 * user data worth exporting. The learned multiplier survived every prior
 * "Delete My Data" run, exactly the silent-gap pattern this function's own
 * header comment warns about.
 */
export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    clearOnboardingCompleted(),
    clearOnboardingDraft(),
    clearProfile(),
    clearCalibration(),
    clearCheckInHistory(),
    clearTodaySession(),
    clearSessionHistory(),
    clearWorkoutLog(),
    clearWeightLog(),
    clearDecisionTraceLog(),
    clearMilestones(),
    clearExercisePerformance(),
    clearNotes(),
    clearBodyMeasurements(),
    clearConditionLog(),
    clearProgressPhotos(),
    disableSessionReminders(),
  ]);
}
