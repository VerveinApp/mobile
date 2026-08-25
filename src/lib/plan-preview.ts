/**
 * The real adaptive engine, ported in from the research vault (see
 * src/lib/engine/ and src/lib/onboarding-to-engine.ts). Runs the actual
 * daily pipeline the vault's own M13 (Adaptation Orchestrator) sequences —
 * not a re-invention of it, the same steps in the same order:
 *
 *   1. Map the user's profile into the engine's OnboardingContext
 *      (onboarding-to-engine.ts) and generate the standing baseline plan
 *      (baseline-plan.ts).
 *   2. Re-derive TODAY's EffectiveConstraintSet from the check-in's energy
 *      score and any symptom tags picked at check-in (constraint-
 *      resolution.ts, M5) and re-run M6 filtering against it (exercise-
 *      filtering.ts). This is what lets a low-energy or symptomatic day
 *      actually exclude unsuitable exercises from the pool, not just do
 *      less of the same ones — the baseline-time filter alone can't do
 *      this, since it has no energy score or acute tags yet.
 *   3. Check the Fallback trigger (fallback-logic.ts, M7): an empty pool or
 *      Energy Score 1 always resolves to the same two always-available
 *      recovery exercises, never an invented minimum session.
 *   4. Otherwise, scale sets/duration per exercise by the real multiplier
 *      chain — energy × symptom-tag overrides × calibration, no condition
 *      multiplier since this app doesn't collect that yet (volume-
 *      scaling.ts, M8).
 *   5. Assemble the session and compute total duration honestly — only
 *      summing exercises that actually carry a duration figure, never
 *      inventing one for the rest (workout-assembly.ts, M10).
 *   6. Build the explanation from the real per-energy templates plus any
 *      firing symptom-tag lines and a calibration-aware line, replacing the
 *      old hand-written 5-line table (explanation-string.ts, M11).
 *
 * SCOPE NOTE — `goal` isn't read here, on purpose, not as an oversight. The
 * vault's own engine treats `primaryGoal` as "cosmetic only — never read by
 * any Layer 3 module" (a founder-reviewed decision) — exercise selection is
 * driven by equipment ceiling, intensity ceiling, focus areas, and today's
 * energy, not by which of the four marketing-facing goals the user picked.
 *
 * SCOPE NOTE — acute symptom tags (picked fresh at each check-in, see
 * home/check-in.tsx and lib/symptom-tags.ts) ARE collected and DO flow
 * through here now — into the daily constraint re-filter (M5), the volume
 * multiplier chain (M8), and the explanation's TAG_LINES (M11). What's
 * still unported: STANDING symptom tags (asked once, persisting daily —
 * deliberately not built, see symptom-tags.ts's own scope note) and the
 * full condition-profile / contraindication system (M2's medical-condition
 * half), which stays collect-only-never-gating per the Chief Architect
 * Audit's own C3 finding until a real validation process exists. Those two
 * remain empty arrays / neutral defaults below.
 */

import { generateBaselinePlan } from '@/lib/engine/baseline-plan';
import { computeEffectiveConstraints } from '@/lib/engine/constraint-resolution';
import { buildExplanation } from '@/lib/engine/explanation-string';
import { filterAndSubstitute } from '@/lib/engine/exercise-filtering';
import { checkFallbackTrigger } from '@/lib/engine/fallback-logic';
import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import { SYMPTOM_OVERRIDE_TABLE } from '@/lib/engine/reference/symptom-override-table';
import type {
  DailyCheckIn,
  Exercise,
  FallbackTrigger,
  PolicyApplicationRecord,
  RepStructure,
  ScaledExerciseList,
  UserCalibration,
} from '@/lib/engine/types';
import { recordPolicyApplications } from '@/lib/engine/policy-orchestration';
import type { TrainingState } from '@/lib/engine/training-state';
import { scaleVolume } from '@/lib/engine/volume-scaling';
import { assembleWorkout } from '@/lib/engine/workout-assembly';
import { localDateStr } from '@/lib/local-date';
import { LOCAL_USER_ID, profileToOnboardingContext } from '@/lib/onboarding-to-engine';
import { ENVIRONMENT_LABELS } from '@/lib/profile-labels';
import type { UserProfile } from '@/lib/user-profile';

/** Matches EnergyGauge's EnergyScore exactly — the full 1–5 check-in scale. */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type PlanPreviewInput = UserProfile;

/** Re-exported from the engine so existing consumers (workout-log.ts) don't
 * need to know the real taxonomy moved — same four values either way. */
export type { BodyArea } from '@/lib/engine/types';

export type PlanExercise = {
  name: string;
  /** null only for a true single-instance exercise (a standalone stretch,
   * a breathing exercise) — never a fabricated set count. NOT mutually
   * exclusive with durationMin: 1,179 of 1,449 library exercises carry
   * both a real sets count and a durationMin (see durationMin's own
   * comment below) — exercise-timer.ts's getExerciseIntervals is the one
   * place that reconciles the two into a real per-set/rest split. */
  sets: number | null;
  reps: number | string | null;
  /** Real for the large majority of the library regardless of whether
   * `sets` is also set — see M10's own honesty note on totalDuration below.
   * When both are present this is the total for the WHOLE exercise block
   * (every set plus rest), never a single hold's length — dividing it by
   * `sets` is exercise-timer.ts's job, not something to do here. */
  durationMin: number | null;
  bodyArea: Exercise['body_area'];
  /** The library's real taxonomy field, not derived from sets/reps/durationMin
   * — an isometric hold (e.g. Plank) can carry a real sets count and a
   * real durationMin at once and still be conceptually a timed hold, not
   * countable reps. exercise-timer.ts uses this to decide whether a work
   * interval's countdown is a real target (never bypassable) or an
   * estimate someone can legitimately finish ahead of. */
  repStructure: RepStructure;
  /** Real library fields, threaded through for exercise-timer.ts's
   * intensity/compound-derived rest length — a heavy compound wants
   * longer rest than a light accessory. Both are null for a real, common
   * share of the library (455 of 1,449 have no is_compound tag), so the
   * rest-length rule treats a null the same as its more conservative
   * (shorter-rest) known value rather than assuming the longer one. */
  intensity: Exercise['intensity'];
  isCompound: Exercise['is_compound'];
  /** The library's real id — check-in.tsx's tap-to-expand descriptions key
   * exercise-form-cues.ts's FORM_CUES/SIMPLE_CUES by this, not by name
   * (names aren't guaranteed unique the way ids are). */
  id: Exercise['id'];
};

export type PlanPreviewResult = {
  exerciseCount: number;
  durationMin: number;
  explanation: string;
  /** Real, from the user's actual equipment answer. */
  equipmentNote: string;
  exercises: PlanExercise[];
  /**
   * 100 = full baseline volume, already folded into `explanation`'s
   * prose but not previously exposed structurally — check-in.tsx needs the
   * real number too, since exerciseCount alone can't tell "genuinely
   * standard session" apart from "same exercise count, every set scaled
   * down" (e.g. Energy 2's real 0.6 setsMultiplier doesn't necessarily
   * drop a whole exercise). See scaleVolume's own doc comment for the
   * known sets-floor-inflation gap this figure inherits.
   */
  overallSetsPct: number;
  /**
   * Minimal decision-trace data — not shown in the UI directly. Feeds
   * engine/training-state.ts's (M20) Stimulus Ledger/Debt fold once a
   * session is actually finished (see lib/decision-trace-log.ts and
   * check-in.tsx's handleFinishSession). Recomputed on every call along
   * with everything else above; only persisted at the one real moment a
   * session completes, not on every gauge-drag re-render.
   */
  trace: {
    fallbackFired: boolean;
    /** Why, when fallbackFired is true — null otherwise. Lets the UI
     * distinguish "today's schedule says rest" from "the engine's safety
     * net kicked in" instead of showing both identically. */
    fallbackTrigger: FallbackTrigger | null;
    gate1Exclusions: { exerciseId: string; excludedBy: string }[];
    deliveredExercises: { exerciseId: string; adapted_sets: number | null }[];
    /** M9's governance bookkeeping — which of P1-P5 fired and how, so an
     * interim policy (P1/P2/P3) can never get silently treated as
     * "resolved" without a real spec change. Not shown in the UI; purely
     * an audit trail for whoever's deciding when those policies graduate. */
    policyApplications: PolicyApplicationRecord[];
  };
};

export function computePlanPreview(
  input: PlanPreviewInput,
  energy: EnergyLevel,
  calibration: UserCalibration,
  acuteSymptomTags: string[] = [],
  /** M13's own optional `trainingState` param (FE-13) — absent means a
   * history-blind run, byte-identical to every call site that doesn't pass
   * one. Only ever used for the one shipped rolling-window sentence below;
   * fetching it is the caller's job since this function stays synchronous. */
  trainingState?: TrainingState,
  /**
   * The one place real external (non-app) data reaches the engine: a
   * multiplier in (0.85, 1] from health-kit.ts's getHealthReadinessModifier,
   * derived from real resting-heart-rate trend. Deliberately app-level, not
   * folded into calibration.ts/M15's own learned multiplier — that one is
   * pure "learned from this app's own feedback," this one is a different
   * real signal with a different source, kept separately attributable
   * rather than blended into a single opaque number. Defaults to 1 (no
   * adjustment) so every call site that doesn't pass one is unaffected.
   */
  healthReadinessModifier: number = 1,
  /**
   * Real check-in-history data, and only when it's literally calendar-
   * yesterday relative to today — not "whenever the user last checked in"
   * (that's comparisonText's looser "last time" framing, a separate UI
   * element). Verifying the date is the caller's job, same division of
   * labor as trainingState/healthReadinessModifier above: this function
   * stays synchronous and never touches the clock itself beyond what
   * localDateStr already does for `checkIn` below. Absent means today's
   * explanation makes no day-over-day claim at all, never a fabricated one.
   */
  yesterdayEnergy?: EnergyLevel
): PlanPreviewResult {
  const ctx = profileToOnboardingContext(input);
  const baselinePlan = generateBaselinePlan(ctx, LOCAL_USER_ID);

  // Step 2 — today's constraint set, re-filtered against the baseline pool.
  const checkIn: DailyCheckIn = {
    userId: LOCAL_USER_ID,
    date: localDateStr(),
    energyScore: energy,
    acuteSymptomTags,
    skipped: false,
  };
  const dailyConstraints = computeEffectiveConstraints(
    checkIn,
    ctx.conditionProfile,
    ctx.standingSymptomTags,
    ctx.movementRestrictions,
    ctx.equipment,
    ctx.conditions
  );
  const filterResult = filterAndSubstitute(baselinePlan, dailyConstraints, ctx.biasSimpleExercises);

  // Standing ∪ acute, deduplicated — the same merge M13 does before both
  // the volume-scaling multiplier lookup and the explanation's tag lines.
  const activeTags = [...new Set([...ctx.standingSymptomTags, ...acuteSymptomTags])];
  const activeSymptomOverrides = activeTags.map((t) => SYMPTOM_OVERRIDE_TABLE[t]).filter(Boolean);

  // Step 3 — Fallback check.
  const fallback = checkFallbackTrigger(filterResult.filtered.length, energy, false);

  let assembledExercises: ScaledExerciseList | [Exercise, Exercise];
  let isRestDay = false;
  let overallSetsPct = 100;
  let fallbackTrigger: FallbackTrigger | null = null;
  let healthModifierChangedOutput = false;

  if (fallback) {
    assembledExercises = fallback.exercises;
    isRestDay = true;
    fallbackTrigger = fallback.trigger;
  } else {
    // Step 4 — volume scaling. energyModifier.setsMultiplier is 0 at
    // Energy Score 1, but that path is already fully claimed by Fallback
    // above, so this only ever runs for 2–5. healthReadinessModifier folds
    // in here (not into calibration.multiplier itself) — scaleVolume never
    // clamps internally by design (FD-3), so the combined value is only as
    // safe as what's passed in; both factors are already independently
    // bounded before reaching this multiplication.
    const energyModifier = ENERGY_MODIFIER_TABLE[energy];
    const volumeResult = scaleVolume(
      filterResult.filtered,
      energyModifier,
      activeSymptomOverrides,
      ctx.conditionProfile.volumeStance,
      calibration.multiplier * healthReadinessModifier
    );

    if (volumeResult.kind === 'stacking-transition-signal') {
      // Unreachable today — volume-scaling.ts's own FD-3 gap always evaluates
      // this false — but handled for type-safety and so this stays a
      // faithful mirror of M13's real branch if that gap is ever resolved.
      const secondFallback = checkFallbackTrigger(filterResult.filtered.length, energy, true)!;
      assembledExercises = secondFallback.exercises;
      isRestDay = true;
      fallbackTrigger = secondFallback.trigger;
    } else {
      assembledExercises = volumeResult.exercises;
      overallSetsPct = volumeResult.overallSetsPct;

      // Never claim a trim that didn't actually survive rounding. scaleVolume's
      // own Math.max(1, Math.round(...)) sets floor and assembleWorkout's
      // 5-minute duration rounding can both fully absorb a small (7-15%)
      // reduction, leaving the delivered plan byte-identical to what
      // healthReadinessModifier=1 would have produced — re-running without
      // it and comparing is the only honest way to know that before saying so.
      if (healthReadinessModifier < 1) {
        const withoutHealthModifier = scaleVolume(
          filterResult.filtered,
          energyModifier,
          activeSymptomOverrides,
          ctx.conditionProfile.volumeStance,
          calibration.multiplier
        );
        healthModifierChangedOutput =
          withoutHealthModifier.kind !== 'stacking-transition-signal' &&
          JSON.stringify(withoutHealthModifier.exercises) !== JSON.stringify(volumeResult.exercises);
      }
    }
  }

  // Step 5 — assembly (honest totalDuration).
  const { workout } = assembleWorkout(assembledExercises, isRestDay);

  // Step 6 — explanation.
  const { explanation: baseExplanation } = buildExplanation(
    energy,
    activeTags,
    calibration,
    assembledExercises,
    workout.totalDuration,
    overallSetsPct
  );

  // M13's one shipped rolling-window sentence (FE-12, verbatim) — the ONLY
  // approved history-trend wording, fired only when yesterday was also a
  // low-energy day and today is too. No other trend copy exists yet
  // (Capacity Trend is trace-only, never templated into prose).
  const withRollingWindow =
    trainingState && energy <= 2 && trainingState.rollingWindow.value.yesterdayLowEnergy
      ? `${baseExplanation} Yesterday you logged low energy too.`
      : baseExplanation;

  // DISCLOSED DIVERGENCE from the comment above (Vervein addition, not in
  // the vault — FE-12's rolling-window sentence is documented as "the ONLY
  // approved history-trend wording" as of that port). Added deliberately:
  // day-to-day plans that read as unrelated to each other is a named real
  // trust risk (VoC research — a plan lighter than yesterday with no
  // stated reason reads as arbitrary, not adaptive). yesterdayEnergy is
  // only ever passed by the caller when it's verified literally-yesterday
  // (see this function's own param comment), so this never claims a
  // day-over-day story that isn't real. Silent whenever energy hasn't
  // actually changed — connecting two identical days needs no sentence.
  const withYesterdayThread =
    yesterdayEnergy !== undefined && yesterdayEnergy !== energy
      ? `${withRollingWindow} ${
          energy > yesterdayEnergy
            ? "You're up from yesterday, so today asks a little more."
            : 'Lighter than yesterday — your energy dipped, so the plan eased off.'
        }`
      : withRollingWindow;

  // Never a silent adjustment, and never an overclaimed one either —
  // healthModifierChangedOutput is only true when the reduction actually
  // survived scaleVolume/assembleWorkout's own rounding (see above), so
  // this never claims a trim that a user comparing exercise-by-exercise
  // wouldn't actually be able to find.
  const explanation = healthModifierChangedOutput
    ? `${withYesterdayThread} Trimmed slightly further — your resting heart rate suggests recovery might not be complete.`
    : withYesterdayThread;

  // ScaledExercise doesn't carry body_area — zip against filterResult.filtered
  // by index rather than a second by-id lookup, since scaleVolume's map()
  // preserves order 1:1 over exactly that list. The Fallback branch already
  // returns full Exercise objects, which carry body_area directly.
  const exercises: PlanExercise[] = assembledExercises.map((ex, i) => {
    if ('exerciseId' in ex) {
      return {
        name: ex.name,
        sets: ex.adapted_sets,
        reps: ex.adapted_reps,
        durationMin: ex.adapted_duration_min,
        bodyArea: filterResult.filtered[i]?.body_area ?? 'full',
        repStructure: filterResult.filtered[i]?.rep_structure ?? 'discrete',
        intensity: filterResult.filtered[i]?.intensity ?? null,
        isCompound: filterResult.filtered[i]?.is_compound ?? null,
        id: ex.exerciseId,
      };
    }
    return {
      name: ex.name,
      sets: ex.base_sets,
      reps: ex.base_reps,
      durationMin: ex.base_duration_min,
      bodyArea: ex.body_area,
      repStructure: ex.rep_structure,
      intensity: ex.intensity,
      id: ex.id,
      isCompound: ex.is_compound,
    };
  });

  const equipmentNote = `Selected from your ${ENVIRONMENT_LABELS[input.environment ?? ''] ?? 'equipment'} setup.`;

  // Fallback-branch exercises are full Exercise objects with an `id`, not a
  // ScaledExercise's `exerciseId`/`adapted_sets` — but ledger/debt folds
  // over these exclude every fallback-fired run anyway (the real engine's
  // own design: M8 never ran, so no planned dose exists to record), so
  // `adapted_sets: null` here is correct, not a gap.
  const deliveredExercises = assembledExercises.map((ex) =>
    'exerciseId' in ex
      ? { exerciseId: ex.exerciseId, adapted_sets: ex.adapted_sets }
      : { exerciseId: ex.id, adapted_sets: null }
  );

  const policyApplications = recordPolicyApplications({
    // Per M13's own real logic: P4's domain is symptom × session (keep-or-
    // remove on the dimensions symptoms act on — body area, intensity,
    // impact). Restriction/contraindication/equipment/inactive exclusions
    // are other Gate 1 rungs and must NOT mark P4 as having executed —
    // an earlier version of this wiring got this wrong (counted any
    // exclusion at all), caught while aligning with M13's canonical order.
    p4Applied: filterResult.gate1Exclusions.some(
      (e) => e.excludedBy === 'body-area' || e.excludedBy === 'intensity' || e.excludedBy === 'impact'
    ),
    p5StackingTransition: fallbackTrigger === 'p5-stacking-transition',
    // !isRestDay alone is wrong for the stacking-transition branch: M8
    // (scaleVolume) genuinely ran there before the second fallback fired,
    // so it's a rest day (isRestDay=true) where m8Ran should still be true.
    // Matches M13's real source, which only ever sets m8Ran: false for the
    // first-fallback branch (scaleVolume never called at all) — true in
    // both the stacking-transition branch and the normal branch.
    m8Ran: !isRestDay || fallbackTrigger === 'p5-stacking-transition',
  });

  return {
    exerciseCount: exercises.length,
    durationMin: workout.totalDuration,
    explanation,
    equipmentNote,
    exercises,
    overallSetsPct,
    trace: {
      fallbackFired: isRestDay,
      fallbackTrigger,
      gate1Exclusions: filterResult.gate1Exclusions,
      deliveredExercises,
      policyApplications,
    },
  };
}
