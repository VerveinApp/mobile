import type { PlanExercise } from '@/lib/plan-preview';

const SECONDS_PER_REP = 3;
const DEFAULT_REPS_WHEN_UNPARSEABLE = 10;

/**
 * Rest length depends on what the set actually demanded, not one flat
 * number for every exercise — a heavy compound (squat, deadlift) needs
 * real recovery between sets; a light accessory doesn't. Derived from two
 * fields the library already has (intensity, is_compound) rather than
 * hand-authoring a rest figure per exercise — rest tolerances are broad
 * (nobody's hurt resting 75s instead of 60s), so a simple tier lookup is
 * enough, same spirit as the duration-estimate tiers above. A null
 * intensity falls to the 'medium' row; a null is_compound (455 of 1,449
 * exercises have no tag either way) is treated as the shorter, accessory-
 * like rest rather than assumed to need the longer compound recovery —
 * consistent with this codebase's own "the honest default is the more
 * permissive one, never an assumed extra" pattern (see e.g.
 * onboarding-to-engine.ts's impactCeiling).
 */
function restSecondsFor(exercise: PlanExercise): number {
  const compound = exercise.isCompound === 'compound';
  if (exercise.intensity === 'high') return compound ? 150 : 90;
  if (exercise.intensity === 'low') return compound ? 60 : 45;
  return compound ? 90 : 60; // 'medium' or unknown intensity
}

export type TimerInterval = {
  kind: 'work' | 'rest';
  seconds: number;
  /** 1-indexed. A rest interval carries the set number it follows (rest after set 2, before set 3). */
  setNumber: number;
  totalSets: number;
  /**
   * True only for a discrete (countable-reps) work interval. That
   * countdown is a rough proxy for "how long these reps probably take,"
   * not a real target — see workSecondsPerSet below — so check-in.tsx lets
   * the user end it early once they've actually finished their reps.
   * False for isometric holds and loaded carries (repStructure, not
   * durationMin — an isometric hold like Plank can still go through the
   * discrete-sets estimate path below when the library has no real
   * duration figure for it, but the countdown is still standing in for a
   * real target time, not an estimate of incidental rep-completion time,
   * so it isn't bypassable either) and for every rest interval (rest has
   * its own pause/resume; this flag isn't about that).
   */
  bypassable: boolean;
};

/** Only reached for the rare isometric_hold/loaded_carry exercise that has
 * a real sets count but no base_duration_min at all (2 of 1,449 in the
 * library: Kegel, Stomach Vacuum) — a discrete exercise always has its own
 * reps-based estimate instead and never reaches this constant. */
const DEFAULT_HOLD_MINUTES_WHEN_UNPARSEABLE = 1;

/**
 * The guided countdown for check-in.tsx's session flow, broken into
 * per-set work/rest intervals instead of one flat total — so the UI can
 * show "Set 2 of 3" / "Rest" instead of a single opaque number that
 * silently bundles every set and every rest gap together.
 *
 * DISCLOSED FIX: this used to branch on `exercise.durationMin !== null`,
 * on the assumption — also wrongly stated in PlanExercise's own old doc
 * comment — that `durationMin` and `sets` never coexist in the library
 * data. They almost always do: 1,179 of 1,449 exercises are real sets×reps
 * or timed-hold movements (e.g. Bodyweight Squat: 3 sets × 15 reps) that
 * ALSO carry a base_duration_min. workout-assembly.ts's own M10 comment
 * says exactly what that field means there: total minutes for the WHOLE
 * exercise block (every set plus rest), used only to sum up overall
 * session length — never a single hold time. Branching on durationMin
 * first meant almost every real exercise skipped the per-set split
 * entirely and rendered as one flat, un-technical countdown. The honest
 * split signal is a real sets count, not whether durationMin happens to be
 * present — `sets` is null only for a true single-instance exercise (a
 * standalone stretch, a breathing exercise) with nothing to subdivide.
 */
export function getExerciseIntervals(exercise: PlanExercise): TimerInterval[] {
  if (exercise.sets === null) {
    // `!== null`, not truthy — a duration of exactly 0 is volume-scaling.ts's
    // own documented 5-minute-rounding gap (a short hold rounding down to
    // nothing), not "no duration data."
    const durationMin = exercise.durationMin !== null ? exercise.durationMin : 0;
    return [
      { kind: 'work', seconds: Math.max(20, durationMin * 60), setNumber: 1, totalSets: 1, bypassable: false },
    ];
  }

  const sets = exercise.sets;
  const bypassable = exercise.repStructure === 'discrete';
  let workSecondsPerSet: number;
  if (bypassable) {
    // Discrete sets×reps: the reps-based pacing estimate, not
    // durationMin/sets — durationMin bakes in rest time too (see above), so
    // dividing it evenly would conflate work and rest into one number.
    // `reps` can be a range string like "10-12/side" — the first number
    // found is used; unparseable values fall back to a flat 10, same spirit
    // as formatExerciseStat's own "never invent a number, but never crash
    // either" handling. ~3 seconds per rep.
    let reps = DEFAULT_REPS_WHEN_UNPARSEABLE;
    if (typeof exercise.reps === 'number') {
      reps = exercise.reps;
    } else if (typeof exercise.reps === 'string') {
      const match = exercise.reps.match(/\d+/);
      if (match) reps = parseInt(match[0], 10);
    }
    workSecondsPerSet = Math.max(10, reps * SECONDS_PER_REP);
  } else {
    // isometric_hold / loaded_carry: durationMin is real, M10-governed
    // data, but represents the WHOLE block, not a single hold — dividing
    // it evenly by sets is an honest per-set estimate, not a fabricated
    // one. Never bypassable (see TimerInterval.bypassable) — this is the
    // actual target, not a pacing guess — floored at 20s so a short total
    // (e.g. Plank: 1 real minute over 3 sets) never rounds down to
    // something meaningless.
    const totalMinutes = exercise.durationMin !== null ? exercise.durationMin : DEFAULT_HOLD_MINUTES_WHEN_UNPARSEABLE;
    workSecondsPerSet = Math.max(20, Math.round((totalMinutes * 60) / sets));
  }
  const restSeconds = restSecondsFor(exercise);

  const intervals: TimerInterval[] = [];
  for (let setNumber = 1; setNumber <= sets; setNumber++) {
    intervals.push({ kind: 'work', seconds: workSecondsPerSet, setNumber, totalSets: sets, bypassable });
    if (setNumber < sets) {
      intervals.push({ kind: 'rest', seconds: restSeconds, setNumber, totalSets: sets, bypassable: false });
    }
  }
  return intervals;
}

export function formatTimerClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
