import { cleanReps, formatExerciseMinutes } from '@/lib/exercise-format';
import { getAllExercisePerformances, type ExercisePerformance } from '@/lib/exercise-performance';
import type { PlanExercise } from '@/lib/plan-preview';
import type { UnitSystem } from '@/lib/unit-preference';
import { displayWeightToKg, formatWeight, parseDecimalInput } from '@/lib/weight-units';
import { getWorkoutLog, type WorkoutLogExercise } from '@/lib/workout-log';

/** The App Store listing the share text links to. */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/vervein/id6804788807';

/**
 * Time trained is only shown inside these bounds. Under a minute isn't a
 * session's real length (a mis-tap through the last exercise), and over
 * three hours is an app left open on the last exercise, not a workout —
 * showing either would put a wrong number on the payoff screen.
 */
export const MIN_SHOWN_TRAINED_SECONDS = 60;
export const MAX_SHOWN_TRAINED_SECONDS = 3 * 60 * 60;

type SummaryPlanFields = Pick<PlanExercise, 'name' | 'sets' | 'reps' | 'durationMin'>;

/** One completed exercise, as it was done. */
export type SessionSummaryExercise = SummaryPlanFields & {
  /** Only when a real, positive weight was typed for it. Stored in kg like
   * every other logged weight (see weight-units.ts) and converted to the
   * user's unit when shown. */
  weightKg?: number;
};

/**
 * What a finished session actually was — saved with today's session at
 * Finish (TodaySession.summary) so the done screen reads the same when
 * reopened. Only what was done: completed exercises in plan order, never
 * the ones that weren't.
 */
export type SessionSummary = {
  /** Wall-clock seconds from Start to Finish, stored as measured — the
   * shown-bounds rule above is applied when displayed, not baked in here.
   * Absent when the session has no real start time. */
  trainedSeconds?: number;
  exercises: SessionSummaryExercise[];
};

/** Built at Finish from check-in.tsx's live session state. */
export function buildSessionSummary({
  exercises,
  completed,
  loggedWeights,
  weightUnit,
  startedAt,
  finishedAt,
}: {
  /** Today's exercises with any swaps applied, in plan order. */
  exercises: SummaryPlanFields[];
  /** Indexes into `exercises` that were actually completed. */
  completed: ReadonlySet<number>;
  /** Raw typed weight text by exercise index, in `weightUnit`. */
  loggedWeights: Record<number, string>;
  weightUnit: UnitSystem;
  startedAt: Date | null;
  finishedAt: Date;
}): SessionSummary {
  const done = exercises.flatMap((exercise, index): SessionSummaryExercise[] => {
    if (!completed.has(index)) return [];
    const typed = parseDecimalInput(loggedWeights[index] ?? '');
    const weightKg = typed !== null && typed > 0 ? displayWeightToKg(typed, weightUnit) : undefined;
    return [
      {
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        durationMin: exercise.durationMin,
        ...(weightKg !== undefined ? { weightKg } : {}),
      },
    ];
  });
  const elapsedMs = startedAt ? finishedAt.getTime() - startedAt.getTime() : NaN;
  return {
    // A clock that moved backwards (a manual time change) isn't a duration.
    ...(elapsedMs >= 0 ? { trainedSeconds: Math.round(elapsedMs / 1000) } : {}),
    exercises: done,
  };
}

/**
 * For a session finished before summaries were saved: rebuilt from what
 * was stored anyway — the workout log's completed exercises, sets/reps from
 * today's frozen plan (only where the name at that index still matches, so
 * a different plan can't lend its numbers), and any weight logged today. No
 * time trained, since no finish time was ever recorded.
 */
export function summaryFromWorkoutLog(
  log: WorkoutLogExercise[],
  plan: SummaryPlanFields[],
  weightsKgByName: Record<string, number>
): SessionSummary {
  return {
    exercises: log.flatMap((entry, index): SessionSummaryExercise[] => {
      if (!entry.completed) return [];
      const planned = plan[index]?.name === entry.name ? plan[index] : null;
      const weightKg = weightsKgByName[entry.name];
      return [
        {
          name: entry.name,
          sets: planned?.sets ?? null,
          reps: planned?.reps ?? null,
          durationMin: planned?.durationMin ?? null,
          ...(weightKg > 0 ? { weightKg } : {}),
        },
      ];
    }),
  };
}

/** Each exercise's weight logged on `date`, from exercise-performance.ts's
 * history (oldest first, so the latest entry is the only one that can be
 * today's). */
export function weightsLoggedOn(
  all: Record<string, ExercisePerformance[]>,
  date: string
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const [name, history] of Object.entries(all)) {
    const latest = history[history.length - 1];
    if (latest?.date === date && latest.weightKg > 0) weights[name] = latest.weightKg;
  }
  return weights;
}

/** The stored pieces summaryFromWorkoutLog rebuilds an unsaved summary
 * from. The plan half comes from check-in.tsx's own rebuilt session. */
export async function loadUnsavedSummarySource(
  date: string
): Promise<{ log: WorkoutLogExercise[]; weightsKgByName: Record<string, number> } | null> {
  const [log, performances] = await Promise.all([getWorkoutLog(date), getAllExercisePerformances()]);
  if (!log) return null;
  return { log: log.exercises, weightsKgByName: weightsLoggedOn(performances, date) };
}

export type SessionSummaryRow = {
  name: string;
  /** "3 × 10 · 135 lb" — null when nothing real is known beyond the name. */
  detail: string | null;
  accessibilityLabel: string;
};

export type SessionSummaryView = {
  /** "42 min", "1 hr 5 min" — null outside the shown bounds or when unknown. */
  trainedLabel: string | null;
  exerciseCount: number;
  /** Sets across completed exercises that carry a real set count — null when
   * none do, rather than a "0 sets" the session didn't earn. */
  setCount: number | null;
  /** The stats line spoken as one VoiceOver element: "Trained 42 minutes, 5 exercises, 14 sets". */
  statsAccessibilityLabel: string;
  rows: SessionSummaryRow[];
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** A real set count — the library's null (a single-instance stretch) and a
 * scaled-to-nothing 0 aren't sets anyone did. */
function realSets(exercise: SummaryPlanFields): number | null {
  return typeof exercise.sets === 'number' && exercise.sets > 0 ? exercise.sets : null;
}

/** Same precedence as check-in.tsx's formatExerciseStat: sets × reps, then
 * sets × a timed hold, then a bare count or duration — never a number the
 * plan didn't produce. A 0-minute duration is volume-scaling's rounding gap,
 * not information. */
function describeVolume(exercise: SummaryPlanFields): { text: string; spoken: string } | null {
  const sets = realSets(exercise);
  const reps = cleanReps(exercise.reps);
  const minutes = exercise.durationMin ? exercise.durationMin : null;
  const time = minutes !== null ? formatExerciseMinutes(minutes) : null;
  if (sets !== null && reps !== null) return { text: `${sets} × ${reps}`, spoken: `${plural(sets, 'set')} of ${reps}` };
  if (sets !== null && time !== null) return { text: `${sets} × ${time}`, spoken: `${plural(sets, 'set')} of ${time}` };
  if (sets !== null) return { text: plural(sets, 'set'), spoken: plural(sets, 'set') };
  if (time !== null) return { text: time, spoken: time };
  return null;
}

function formatTrained(seconds: number): { text: string; spoken: string } {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return { text: `${totalMinutes} min`, spoken: plural(totalMinutes, 'minute') };
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? { text: `${hours} hr`, spoken: plural(hours, 'hour') }
    : { text: `${hours} hr ${minutes} min`, spoken: `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` };
}

/** The done screen's display model — weights shown in `unit`. */
export function describeSessionSummary(summary: SessionSummary, unit: UnitSystem): SessionSummaryView {
  const seconds = summary.trainedSeconds;
  const trained =
    seconds !== undefined && seconds >= MIN_SHOWN_TRAINED_SECONDS && seconds <= MAX_SHOWN_TRAINED_SECONDS
      ? formatTrained(seconds)
      : null;
  let setCount: number | null = null;
  for (const exercise of summary.exercises) {
    const sets = realSets(exercise);
    if (sets !== null) setCount = (setCount ?? 0) + sets;
  }
  const rows = summary.exercises.map((exercise): SessionSummaryRow => {
    const volume = describeVolume(exercise);
    const weight = exercise.weightKg && exercise.weightKg > 0 ? formatWeight(exercise.weightKg, unit) : null;
    const detail = [volume?.text, weight].filter(Boolean).join(' · ');
    const spoken = [exercise.name, volume?.spoken, weight].filter(Boolean).join(', ');
    return { name: exercise.name, detail: detail === '' ? null : detail, accessibilityLabel: spoken };
  });
  const exerciseCount = summary.exercises.length;
  const statsAccessibilityLabel = [
    trained ? `Trained ${trained.spoken}` : null,
    plural(exerciseCount, 'exercise'),
    setCount !== null ? plural(setCount, 'set') : null,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    trainedLabel: trained?.text ?? null,
    exerciseCount,
    setCount,
    statsAccessibilityLabel,
    rows,
  };
}

/**
 * The one line Share hands the share sheet — counts and time only, no
 * health data (no calories, energy, symptoms or body measurements), and
 * null when there's nothing done to share.
 */
export function getSessionShareText(view: SessionSummaryView): string | null {
  if (view.exerciseCount === 0) return null;
  const counts = [plural(view.exerciseCount, 'exercise'), view.setCount !== null ? plural(view.setCount, 'set') : null]
    .filter(Boolean)
    .join(', ');
  const trained = view.trainedLabel ? `Trained ${view.trainedLabel}` : 'Trained';
  return `${trained} with VerveIn today: ${counts}. ${APP_STORE_URL}`;
}
