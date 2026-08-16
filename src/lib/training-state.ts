import { compileTrainingState, type TrainingState } from '@/lib/engine/training-state';
import { getDecisionTraceLog } from '@/lib/decision-trace-log';
import { localDateStr } from '@/lib/local-date';
import { getSessionHistory } from '@/lib/session-history';

/**
 * Combines the two real logs M20 folds over — session-history.ts's energy
 * record and decision-trace-log.ts's per-session engine output — and runs
 * the real compiler. Entries logged before energy tracking existed are
 * skipped, same as deload.ts's own handling of the same gap.
 */
export async function getTrainingState(): Promise<TrainingState> {
  const [history, traces] = await Promise.all([getSessionHistory(), getDecisionTraceLog()]);

  const checkIns = history
    .filter((e) => e.energy !== undefined)
    .map((e) => ({ date: e.date, energyScore: e.energy as number, skipped: false }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return compileTrainingState({ checkIns, traces, referenceDate: localDateStr() });
}
