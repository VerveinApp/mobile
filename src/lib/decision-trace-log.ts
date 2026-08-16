import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MinimalDecisionTrace } from '@/lib/engine/training-state';

const KEY = 'vervein.decisionTraceLog.v1';
const MAX_ENTRIES = 30; // matches session-history.ts's rolling window; comfortably above LEDGER_WINDOW_N (14)

type StoredTrace = MinimalDecisionTrace & { date: string };

/**
 * The minimal per-session engine record M20 (training-state.ts) folds over
 * — what Gate 1 excluded and what actually got delivered, not the full
 * Decision Trace (M12), which was never ported. Recorded once, when a
 * session actually finishes (see check-in.tsx's handleFinishSession), not
 * on every plan-preview.ts call.
 */
async function readAll(): Promise<StoredTrace[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredTrace[]) : [];
  } catch {
    return [];
  }
}

export async function recordDecisionTrace(
  date: string,
  trace: {
    fallbackFired: boolean;
    gate1Exclusions: { exerciseId: string; excludedBy: string }[];
    deliveredExercises: { exerciseId: string; adapted_sets: number | null }[];
  }
) {
  try {
    const entries = await readAll();
    const withoutToday = entries.filter((e) => e.date !== date);
    const stored: StoredTrace = {
      date,
      fallbackFired: trace.fallbackFired,
      gate1Exclusions: trace.gate1Exclusions,
      output: {
        exercises: trace.deliveredExercises.map((e) => ({
          exerciseId: e.exerciseId,
          adapted_sets: e.adapted_sets ?? undefined,
        })),
      },
    };
    const next = [...withoutToday, stored].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Worst case Stimulus Ledger/Debt read a little sparse — never a crash, and the session itself is still recorded via workout-log.ts.
  }
}

/** Every stored trace, oldest first — matches compileTrainingState's expected ordering. */
export async function getDecisionTraceLog(): Promise<StoredTrace[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
}
