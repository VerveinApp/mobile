import { compileTrainingState, type TrainingState } from '@/lib/engine/training-state';
import { getDecisionTraceLog } from '@/lib/decision-trace-log';
import { localDateStr } from '@/lib/local-date';
import { getRecentSessionHistory } from '@/lib/session-history';

/**
 * Combines the two real logs M20 folds over — session-history.ts's energy
 * record and decision-trace-log.ts's per-session engine output — and runs
 * the real compiler. Entries logged before energy tracking existed are
 * skipped, same as deload.ts's own handling of the same gap.
 */
export async function getTrainingState(): Promise<TrainingState> {
  // The last ROLLING_WINDOW_DAYS entries only — exactly what the engine saw
  // back when session history was capped at that size (see
  // getRecentSessionHistory). Longer retention is for display, not for
  // changing what the plan is built from.
  const [history, traces] = await Promise.all([getRecentSessionHistory(), getDecisionTraceLog()]);

  const checkIns = history
    .filter((e) => e.energy !== undefined)
    .map((e) => ({
      date: e.date,
      energyScore: e.energy as number,
      // completionStatus is the precise signal when present; entries logged
      // before that field existed fall back to the older `completed`
      // boolean. Previously hardcoded false here, so rollingWindow.days[].
      // skipped could never report true regardless of real session outcome.
      skipped: e.completionStatus ? e.completionStatus === 'skipped' : !e.completed,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return compileTrainingState({ checkIns, traces, referenceDate: localDateStr() });
}
