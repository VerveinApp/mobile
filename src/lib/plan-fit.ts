import AsyncStorage from '@react-native-async-storage/async-storage';

import { exerciseLibrary } from '@/lib/engine/exercise-library';
import type { StoredTrace } from '@/lib/decision-trace-log';
import { localDateStr } from '@/lib/local-date';

const LAST_SHOWN_KEY = 'vervein.planFit.lastShown.v1';
// How many of the most recent non-fallback sessions to look at, and how many
// of those an exercise must be excluded from before it's a real pattern
// rather than one unlucky day. Same "don't fire on noise" discipline as
// coaching-insights.ts's MIN_OCCURRENCES and momentum.ts's own threshold —
// picked so a single rough day never triggers this, but a genuinely
// recurring exclusion (the vault's "an exercise excluded 4 of 5 sessions is
// a plan defect, not a daily adaptation") does.
const WINDOW_N = 5;
const MIN_EXCLUDED_COUNT = 4;
const COOLDOWN_DAYS = 14;

/**
 * Vervein addition, not in the vault — a bounded, informational reading of
 * the Master Evolution Roadmap's "Plan-Fit Audit" idea (§6.6): "the engine
 * measuring its own behavior... an exercise excluded 4 of 5 sessions is a
 * plan defect, not a daily adaptation." The vault's own version proposes
 * actual plan revision; this stays at the note-only tier every other insight
 * in this app uses (coaching-insights.ts, momentum.ts) — surfaced, never
 * acted on automatically, since a real revision would mean editing the
 * baseline composition itself (baseline-plan.ts), a bigger, founder-level
 * change this isn't taking on.
 *
 * Reads decision-trace-log.ts's StoredTrace[] directly rather than
 * TrainingState.decisionMemory — that field's own fold only keeps an
 * aggregate {fallbackFired, exclusions: count} per run, not which exercise
 * was excluded, which is exactly what a per-exercise recurrence check needs.
 */
function findRecurringExclusion(traces: StoredTrace[]): string | null {
  const nonFallback = traces.filter((t) => !t.fallbackFired);
  const window = nonFallback.slice(-WINDOW_N);
  if (window.length < WINDOW_N) return null;

  const exclusionCounts = new Map<string, number>();
  for (const trace of window) {
    for (const excl of trace.gate1Exclusions) {
      exclusionCounts.set(excl.exerciseId, (exclusionCounts.get(excl.exerciseId) ?? 0) + 1);
    }
  }

  for (const [exerciseId, count] of exclusionCounts) {
    if (count >= MIN_EXCLUDED_COUNT) return exerciseId;
  }
  return null;
}

/**
 * Same "occasional aside, not a repeating nag" cooldown pattern as
 * coaching-insights.ts. Silent whenever the pattern isn't real yet, the
 * excluded exercise's name can't be resolved (data integrity, never a
 * fabricated generic name), or the note was already shown within
 * COOLDOWN_DAYS.
 */
export async function getPlanFitNote(traces: StoredTrace[]): Promise<string | null> {
  const exerciseId = findRecurringExclusion(traces);
  if (!exerciseId) return null;
  const exercise = exerciseLibrary.getById(exerciseId);
  if (!exercise) return null;

  try {
    const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    if (lastShown) {
      const daysSince = Math.floor((Date.now() - new Date(lastShown).getTime()) / 86400000);
      if (daysSince < COOLDOWN_DAYS) return null;
    }
    await AsyncStorage.setItem(LAST_SHOWN_KEY, localDateStr());
  } catch {
    return null;
  }

  return `${exercise.name} has been swapped out of most of your recent sessions — worth a look next time you review your plan.`;
}
