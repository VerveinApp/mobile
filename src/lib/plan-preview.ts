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

import { generateBaselinePlan, type OnboardingContext } from '@/lib/engine/baseline-plan';
import { computeEffectiveConstraints } from '@/lib/engine/constraint-resolution';
import { buildExplanation } from '@/lib/engine/explanation-string';
import { filterAndSubstitute } from '@/lib/engine/exercise-filtering';
import { checkFallbackTrigger } from '@/lib/engine/fallback-logic';
import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import { SYMPTOM_OVERRIDE_TABLE } from '@/lib/engine/reference/symptom-override-table';
import type {
  BaselinePlan,
  DailyCheckIn,
  EffectiveConstraintSet,
  Exercise,
  FallbackTrigger,
  PolicyApplicationRecord,
  RepStructure,
  ScaledExerciseList,
  UserCalibration,
} from '@/lib/engine/types';
import { recordPolicyApplications } from '@/lib/engine/policy-orchestration';
import { bodyAreaPriorityScore, type TrainingState } from '@/lib/engine/training-state';
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
   * Vervein addition, not in the vault — today's real EffectiveConstraintSet
   * (M5's output, already computed above to run Gate 1 against). Exposed so
   * exercise-swap.ts can filter mid-workout swap candidates through the exact
   * same Gate 1 rule (exercise-filtering.ts's passesConstraints) this session
   * itself was built under — a swap can never surface an exercise today's own
   * filtering pass would have excluded.
   */
  constraints: EffectiveConstraintSet;
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
   * Vervein addition, not in the vault — M8/M10's own flagged rounding-gap
   * diagnostics (see this function's own knownGaps-threading comment), real
   * and honest but written for engineers, not end users. Not rendered
   * anywhere in the UI by design; exists so this data is inspectable at all
   * instead of silently discarded, and feeds a dev-only console warning.
   */
  knownGaps: string[];
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

/**
 * Vervein addition, not in the vault — reads TrainingState's stimulusDebt
 * (shortfall by body area, real accumulated data, computed every run and
 * never consumed anywhere before this) and recency (days since an area was
 * last trained) to decide which body area's exercises lead today's list,
 * instead of the baseline's fixed onboarding-time order every day. Order
 * only, never eligibility — no exercise is added or removed here, so this
 * can't produce the empty-pool failure a real filter could (same distinction
 * baseline-plan.ts's own bySelectionOrder divergence already draws for its
 * experience bias). Two real, compounding benefits from the same reorder:
 * the guided timer runs the most under-trained area first (while the person
 * has the most energy for it), and the time-available trim step (which cuts
 * from the end of the list) protects that area last.
 *
 * The actual priority score (debt vs. recency weighting) lives in
 * training-state.ts's bodyAreaPriorityScore — see its own doc comment.
 * Silent (returns the original order unchanged) unless trainingState has at
 * least provisional evidence for one of the two fields — deliberate
 * epistemic humility, same rule as every other TrainingState reader in this
 * codebase: don't act on a field its own tier calls thin.
 */
function reorderByBodyAreaPriority(
  filtered: Exercise[],
  trainingState: TrainingState | undefined
): Exercise[] {
  if (!trainingState) return filtered;
  if (trainingState.stimulusDebt.tier === 'insufficient' && trainingState.recency.tier === 'insufficient') {
    return filtered;
  }

  // Shared with session-reminders.ts's own neglected-area wording — see
  // bodyAreaPriorityScore's own doc comment in training-state.ts for why
  // this moved there instead of staying a second, driftable copy here.
  // Array.prototype.sort is stable (ES2019+, Hermes included) — exercises
  // within the same body area keep their original relative order.
  return [...filtered].sort(
    (a, b) => bodyAreaPriorityScore(trainingState, b.body_area) - bodyAreaPriorityScore(trainingState, a.body_area)
  );
}

// Vervein-chosen UX threshold, not a safety/training-load number — how many
// days of absence counts as worth a "welcome back" line, long enough that it
// clearly isn't just yesterday or an ordinary rest day. Same status as
// coaching-insights.ts's MIN_OCCURRENCES/plan-fit.ts's WINDOW_N: a
// copy-timing constant, not a clinical claim, so picking a reasonable value
// here doesn't carry the same "unauthorized number" risk as inventing an
// actual volume-reduction ramp would.
const RETURN_GAP_MIN_DAYS = 5;

// Exported (Vervein addition) so session-reminders.ts's own neglected-area
// wording uses the exact same real-world names as this file's own
// "Started with X — it's fallen behind the rest lately" observation, rather
// than a second, driftable copy of these labels.
export const BODY_AREA_PRIORITY_LABEL: Record<Exercise['body_area'], string> = {
  upper: 'upper body',
  lower: 'legs',
  core: 'core',
  full: 'full-body work',
};

// Vervein addition, not in the vault — module-level memo keyed by object
// identity (the profile reference), not deep equality. Safe because
// profileToOnboardingContext is a pure function of `input` (no external
// state — onboarding-to-engine.ts) and this app has exactly one on-device
// profile at a time, never a multi-profile switch mid-session (see that
// file's own "local-user, no backend" framing) — a single-slot cache is the
// right shape here, not an LRU. generateBaselinePlan's real cost (filtering
// + sorting the full exercise library) depends only on the profile, never on
// energy/symptoms/time/calibration — but every one of those changes re-runs
// computePlanPreview via check-in.tsx's useMemo (energy changes on every
// gauge-drag step), so without this, the full library filter+sort reran on
// every drag step even though its result couldn't possibly have changed.
// Self-invalidates the moment a genuinely new profile object is passed in —
// a real profile edit always produces a new object (setState never mutates
// in place), so there's no staleness case a reference check could miss.
let cachedProfileInput: PlanPreviewInput | null = null;
let cachedBaselinePlan: BaselinePlan | null = null;

function getBaselinePlanCached(input: PlanPreviewInput, ctx: OnboardingContext): BaselinePlan {
  if (input === cachedProfileInput && cachedBaselinePlan) return cachedBaselinePlan;
  cachedProfileInput = input;
  cachedBaselinePlan = generateBaselinePlan(ctx, LOCAL_USER_ID);
  return cachedBaselinePlan;
}

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
  yesterdayEnergy?: EnergyLevel,
  /**
   * Vervein addition, not in the vault (same disclosure as yesterdayEnergy
   * above) — a hard ceiling from the check-in's own "how much time do you
   * have today?" input, genuinely independent of energy: someone can have
   * high energy and 15 minutes, or low energy and an hour. Undefined means
   * no constraint, byte-identical to every call site that doesn't pass one.
   */
  timeAvailableMin?: number,
  /**
   * Vervein addition, not in the vault — days since the caller's own
   * verified last real check-in (check-in.tsx's realLastCheckIn), same
   * "caller verifies the date, this function stays clock-free" division of
   * labor as yesterdayEnergy above. This is the vault's own "Return Ramp"
   * idea (Master Evolution Roadmap §6.8) scoped down to exactly what it
   * marks safe to ship without a founder decision: detection + an honest
   * "welcome back" voice, never a numeric volume/intensity adjustment — the
   * vault is explicit that the actual ramp TABLE (how much lighter, for how
   * many days, scaled by absence length) is blocked on founder-approved
   * values and detraining-methodology research that doesn't exist yet.
   * Inventing a reduction schedule here would be exactly the kind of
   * unauthorized number this codebase has repeatedly refused to invent, so
   * this only ever changes what the explanation SAYS, never what the plan
   * actually delivers. Undefined means no absence claim at all.
   */
  daysSinceLastCheckIn?: number,
  /**
   * Vervein addition, not in the vault — wires up BASE_TEMPLATES[5]'s own
   * rhetorical question ("Want an optional finisher set added to each
   * exercise?", explanation-string.ts, verbatim M11 copy) to an actual
   * mechanism. Before this param existed, that question had no way to be
   * answered — the exact "looks like it works, doesn't" gap this app has
   * caught and fixed elsewhere (Apple/Google sign-in). Only meaningful at
   * energy 5 (the caller gates the UI the same way; this function ignores it
   * at any other energy rather than trusting the caller twice). Adds exactly
   * one set per exercise — literally "a finisher set," not a second workout —
   * applied after the time-available trim so the stated time ceiling still
   * governs which exercises survive; the finisher is an explicit opt-in on
   * top of that, not itself bounded by it.
   */
  finisherAccepted?: boolean,
  /**
   * Which real signal(s) actually produced healthReadinessModifier above —
   * health-kit.ts's getHealthReadinessReasons, the caller's job to fetch
   * (same division of labor as trainingState/healthReadinessModifier
   * themselves). Undefined falls back to the older RHR-only phrasing below
   * rather than a broken sentence — every existing call site keeps working
   * unchanged if it doesn't pass this yet.
   */
  healthReadinessReasons?: { rhrElevated: boolean; sleepDeficit: boolean }
): PlanPreviewResult {
  const ctx = profileToOnboardingContext(input);
  const baselinePlan = getBaselinePlanCached(input, ctx);

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
  // Body-area priority reorder (Vervein addition — see the function's own
  // doc comment). Every downstream use of "today's eligible exercises in
  // order" reads this, not filterResult.filtered directly, so the reorder
  // stays consistent across volume scaling, the trim step, and the final
  // per-exercise metadata zip below — a partial reorder (some call sites
  // updated, others not) would silently misalign body areas by index.
  const prioritizedFiltered = reorderByBodyAreaPriority(filterResult.filtered, trainingState);
  const prioritizedArea =
    prioritizedFiltered[0] && filterResult.filtered[0] && prioritizedFiltered[0].body_area !== filterResult.filtered[0].body_area
      ? prioritizedFiltered[0].body_area
      : null;

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
  // Set inside the real-scaling branch below (Step 4.5) — stays false for
  // both Fallback branches, since isRestDay guards trimming from ever
  // running against the two safety exercises.
  let timeTrimmed = false;
  // Set inside the real-scaling branch below (Step 4.6) — stays false for
  // both Fallback branches, same reasoning as timeTrimmed above (a fallback
  // session is the engine's safety pair, never a candidate for an optional
  // add-on).
  let finisherApplied = false;
  // M8's own flagged rounding-gap messages (see volume-scaling.ts's header
  // comment) — collected here rather than discarded the moment scaleVolume
  // returns, which is what happened before this field existed. Empty for
  // both Fallback branches: M8 never runs there, so there's nothing to flag.
  let volumeKnownGaps: string[] = [];

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
      prioritizedFiltered,
      energyModifier,
      activeSymptomOverrides,
      ctx.conditionProfile.volumeStance,
      calibration.multiplier * healthReadinessModifier
    );
    // Present on both union members (scaled or stacking-transition-signal)
    // — captured unconditionally rather than only in the 'scaled' branch.
    volumeKnownGaps = volumeResult.knownGaps;

    if (volumeResult.kind === 'stacking-transition-signal') {
      // Unreachable today — volume-scaling.ts's own FD-3 gap always evaluates
      // this false — but handled for type-safety and so this stays a
      // faithful mirror of M13's real branch if that gap is ever resolved.
      const secondFallback = checkFallbackTrigger(filterResult.filtered.length, energy, true)!;
      assembledExercises = secondFallback.exercises;
      isRestDay = true;
      fallbackTrigger = secondFallback.trigger;
    } else {
      // Step 4.5 — time-available ceiling (Vervein addition, not in the
      // vault — same disclosure pattern as the yesterday-thread comment
      // above), applied here, before overallSetsPct/healthModifierChangedOutput
      // are computed, not after — both of those need to describe the plan
      // actually delivered, not the pre-trim one a review pass caught them
      // silently describing instead. A hard ceiling, not a soft scaling
      // preference the way energy is: trims from the end of the already-
      // prioritized list.
      //
      // BUG FIX: the floor here MUST be 2, not 1 — assembleWorkout (M10) has
      // its own hard, vault-verbatim contract ("received fewer than 2
      // exercises... upstream should never allow this") and throws
      // uncaught otherwise. This function is exactly the "upstream" that
      // contract is trusting; a `trimmedLength > 1` floor let this step
      // legally produce a 1-exercise list on an ordinary input (e.g. the
      // 15-minute time-available preset on a normal-energy day whose top 2
      // prioritized exercises alone already exceed it) and crash the plan
      // preview outright. filterResult.filtered.length <= 1 already routes
      // to Fallback before this branch ever runs (fallback-logic.ts), so
      // volumeResult.exercises always starts at length >= 2 here — stopping
      // at 2 is a real floor, not a silent shortfall this session can't
      // reach. A genuinely too-long 2-exercise pair (e.g. two long holds
      // against a short budget) can still leave the result over budget —
      // that's the known, disclosed "for" vs "fit" gap this function's own
      // explanation-building step further down already accounts for.
      let trimmedLength = volumeResult.exercises.length;
      if (timeAvailableMin !== undefined) {
        while (
          trimmedLength > 2 &&
          assembleWorkout(volumeResult.exercises.slice(0, trimmedLength), false).workout.totalDuration >
            timeAvailableMin
        ) {
          trimmedLength -= 1;
          timeTrimmed = true;
        }
      }
      const trimmedExercises = volumeResult.exercises.slice(0, trimmedLength);

      // Step 4.6 — optional finisher (Vervein addition — see this function's
      // own finisherAccepted param comment for what this wires up and why).
      // Energy-gated here too, not just trusted from the caller. Applied
      // after the trim above, on top of what the time ceiling already
      // decided survives — an explicit opt-in, not itself time-bounded.
      // +1 set only to exercises that actually carry a sets count;
      // duration-only exercises (base_sets null — a stretch, a hold with no
      // countable set) have no "set" to add one to, so those pass through
      // unchanged rather than fabricating a sets value that never existed.
      finisherApplied = energy === 5 && finisherAccepted === true;
      assembledExercises = finisherApplied
        ? trimmedExercises.map((ex) => (ex.adapted_sets !== null ? { ...ex, adapted_sets: ex.adapted_sets + 1 } : ex))
        : trimmedExercises;

      // Recomputed over the surviving subset only, not volumeResult's own
      // pre-trim figure — same ratio-average formula volume-scaling.ts
      // itself uses (adapted_sets / base_sets, averaged), just scoped to
      // what's actually delivered after the trim above.
      const survivingRatios = prioritizedFiltered
        .slice(0, trimmedLength)
        .map((ex, i) => {
          const adapted = trimmedExercises[i].adapted_sets;
          return ex.base_sets !== null && adapted !== null ? adapted / ex.base_sets : null;
        })
        .filter((r): r is number => r !== null);
      overallSetsPct =
        survivingRatios.length > 0
          ? Math.round((survivingRatios.reduce((a, b) => a + b, 0) / survivingRatios.length) * 100)
          : 100;

      // Never claim a trim that didn't actually survive rounding. scaleVolume's
      // own Math.max(1, Math.round(...)) sets floor and assembleWorkout's
      // 5-minute duration rounding can both fully absorb a small (7-15%)
      // reduction, leaving the delivered plan byte-identical to what
      // healthReadinessModifier=1 would have produced — re-running without
      // it and comparing is the only honest way to know that before saying so.
      // Truncated to the same trimmedLength before diffing — otherwise a
      // difference living only in exercises the time-trim already removed
      // could fire this note for a change nobody could actually find in the
      // final delivered plan.
      if (healthReadinessModifier < 1) {
        const withoutHealthModifier = scaleVolume(
          prioritizedFiltered,
          energyModifier,
          activeSymptomOverrides,
          ctx.conditionProfile.volumeStance,
          calibration.multiplier
        );
        healthModifierChangedOutput =
          withoutHealthModifier.kind !== 'stacking-transition-signal' &&
          JSON.stringify(withoutHealthModifier.exercises.slice(0, trimmedLength)) !==
            JSON.stringify(trimmedExercises);
      }
    }
  }

  // Step 5 — assembly (honest totalDuration).
  const { workout, knownGaps: assemblyKnownGaps } = assembleWorkout(assembledExercises, isRestDay);

  // Step 6 — explanation.
  const { explanation: rawBaseExplanation } = buildExplanation(
    energy,
    activeTags,
    calibration,
    assembledExercises,
    workout.totalDuration,
    overallSetsPct
  );

  // DISCLOSED (Vervein addition, not in the vault — see this function's own
  // daysSinceLastCheckIn param comment for why this is voice-only, no
  // numeric adjustment). Prefixed rather than appended: a welcome-back
  // greeting reads naturally as the opening line, not a trailing aside.
  const baseExplanation =
    daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn >= RETURN_GAP_MIN_DAYS
      ? `Welcome back — it's been ${daysSinceLastCheckIn} days. ${rawBaseExplanation}`
      : rawBaseExplanation;

  // EXPLANATION VOICE BUDGET (Vervein addition — the vault's Master
  // Evolution Roadmap names this exact risk at §11.8: "with trend/debt/
  // counterfactual/tier voices arriving, a priority order and sentence cap
  // become necessary; unbounded honesty becomes noise"). Collected as an
  // ordered array instead of the previous design's chain of variables each
  // referencing the last one's name — that pattern had no cap at all, and
  // was also its own copy-paste risk (each new sentence had to correctly
  // thread the prior variable through). Array order below IS priority
  // order: on a day where several of these genuinely fire at once, only the
  // first MAX_OBSERVATIONS survive. Two sentences further down (the
  // finisher confirmation and the time-trim note) are deliberately kept
  // OUTSIDE this array and never dropped — they confirm something the user
  // just explicitly chose (accepted the finisher, picked a time budget),
  // not something the engine is passively volunteering, so those are never
  // the ones that should go silent on a busy day.
  const observations: string[] = [];

  // Priority 1 — M13's one shipped rolling-window sentence (FE-12, verbatim)
  // plus its Vervein-added streak-length follow-up, combined into a single
  // slot so the cap can never split a pair that only ever fires together
  // (consecutiveLowDays >= 2 necessarily implies yesterdayLowEnergy too).
  // The follow-up reads rollingWindow.consecutiveLowDays (computed every
  // run, previously unread anywhere) to name the real streak length once
  // it's 3+ days instead of just repeating "yesterday too" — the vault's
  // own committee names this "differential explanation" as one of Decision
  // Memory/rolling-window's cheapest real upgrades. tier-gated like every
  // other TrainingState read.
  if (trainingState && energy <= 2 && trainingState.rollingWindow.value.yesterdayLowEnergy) {
    let sentence = 'Yesterday you logged low energy too.';
    if (
      trainingState.rollingWindow.tier !== 'insufficient' &&
      trainingState.rollingWindow.value.consecutiveLowDays >= 2
    ) {
      sentence += ` That's ${trainingState.rollingWindow.value.consecutiveLowDays + 1} low-energy days in a row.`;
    }
    observations.push(sentence);
  }

  // Priority 2 — gapFillShortfall (Vervein addition, not in the vault).
  // exercise-filtering.ts has always computed this — a real, honest count of
  // how many removed slots the library couldn't refill under today's
  // constraints — but nothing ever read it before this. Left unsurfaced, a
  // heavily-constrained day (low energy plus several symptom tags plus
  // limited equipment can genuinely exhaust the substitute pool) delivered a
  // visibly shorter session than the composition rule intended, with no
  // explanation anywhere — the one place this codebase's own "never a
  // silent adjustment" rule was actually being broken in practice. Gated to
  // the real-scaling branch (!isRestDay): a Fallback session is a fixed
  // safety pair, unrelated to this count, and already has its own honest,
  // distinct messaging (FALLBACK_TRIGGER_TEXT in check-in.tsx).
  if (!isRestDay && filterResult.gapFillShortfall > 0) {
    observations.push(
      `Today's constraints left ${filterResult.gapFillShortfall} fewer exercise${
        filterResult.gapFillShortfall === 1 ? '' : 's'
      } available than usual.`
    );
  }

  // Priority 3 — never a silent adjustment, and never an overclaimed one
  // either: healthModifierChangedOutput is only true when the reduction
  // actually survived scaleVolume/assembleWorkout's own rounding (see that
  // flag's own computation above), so this never claims a trim a user
  // comparing exercise-by-exercise wouldn't actually be able to find.
  // Which reason(s) actually fired matters now that there are two possible
  // real causes (RHR, sleep) instead of one — naming both when both are
  // real, rather than crediting the trim to only one of them.
  if (healthModifierChangedOutput) {
    const { rhrElevated, sleepDeficit } = healthReadinessReasons ?? { rhrElevated: true, sleepDeficit: false };
    const reasons: string[] = [];
    if (rhrElevated) reasons.push('your resting heart rate suggests recovery might not be complete');
    if (sleepDeficit) reasons.push('last night was short relative to your usual');
    observations.push(`Trimmed slightly further — ${(reasons.length > 0 ? reasons : ['recovery might not be complete']).join(', and ')}.`);
  }

  // Priority 4 — DISCLOSED DIVERGENCE (Vervein addition, not in the vault —
  // FE-12's rolling-window sentence is documented as "the ONLY approved
  // history-trend wording" as of that port). Added deliberately: day-to-day
  // plans that read as unrelated to each other is a named real trust risk
  // (VoC research — a plan lighter than yesterday with no stated reason
  // reads as arbitrary, not adaptive). yesterdayEnergy is only ever passed
  // by the caller when it's verified literally-yesterday (see this
  // function's own param comment), so this never claims a day-over-day
  // story that isn't real. Silent whenever energy hasn't actually changed —
  // connecting two identical days needs no sentence.
  //
  // HYSTERESIS (Vervein addition — vault's Master Evolution Roadmap §6.4,
  // "restraint... a great coach ignores noise"). Scoped to THIS sentence's
  // wording only, never to the actual plan: today's real energy score still
  // drives every set/exercise decision above regardless of the dampening
  // below, because the person just told the app how they feel today and the
  // plan owes them an honest reaction to that — dead-banding the real input
  // would be dishonest, not restrained. What gets dampened is narrower: the
  // CLAIM that a one-point wobble is meaningful, when capacityTrend's own
  // tiered evidence doesn't yet back that up. A 2+ point swing is always
  // substantial enough to name; a bare 1-point swing is only named once
  // capacityTrend has enough basis to call a real direction (not
  // 'insufficient' and not already 'stable') — "one slightly lower score
  // isn't a trend" made literal.
  const yesterdayDelta = yesterdayEnergy !== undefined ? energy - yesterdayEnergy : null;
  const isNoiseSwing =
    yesterdayDelta !== null &&
    Math.abs(yesterdayDelta) === 1 &&
    (!trainingState || trainingState.capacityTrend.tier === 'insufficient' || trainingState.capacityTrend.value === 'stable');
  if (yesterdayEnergy !== undefined && yesterdayEnergy !== energy && !isNoiseSwing) {
    observations.push(
      energy > yesterdayEnergy
        ? "You're up from yesterday, so today asks a little more."
        : 'Lighter than yesterday — your energy dipped, so the plan eased off.'
    );
  }

  // Priority 5 — DISCLOSED (Vervein addition, not in the vault) — names the
  // body-area reorder above only when it actually moved something
  // (prioritizedArea is null otherwise, see reorderByBodyAreaPriority's own
  // comment), same "never a silent adjustment" rule as every other note in
  // this chain. Deliberately vague between "hasn't been trained in a while"
  // (recency) and "has been getting fewer sets than the rest" (stimulus
  // debt) — priorityOf blends both, so naming one specific mechanism as THE
  // reason would overclaim whichever one didn't actually drive it this time.
  // Lowest priority of the capped observations: nice context, lowest stakes.
  if (prioritizedArea) {
    observations.push(`Started with ${BODY_AREA_PRIORITY_LABEL[prioritizedArea]} — it's fallen behind the rest lately.`);
  }

  const MAX_OBSERVATIONS = 3;
  const withObservations = [baseExplanation, ...observations.slice(0, MAX_OBSERVATIONS)].join(' ');

  // Confirms the finisher actually landed — BASE_TEMPLATES[5] only ever asks
  // the question, never confirms an answer (M11 is verbatim; this is layered
  // after it like every other disclosed sentence in this chain). Exempt from
  // the cap above — see this block's own header comment. Earns a more
  // specific line (Vervein addition, the vault's "Opportunity Detection"
  // idea, §5 ★★★★ tier, scoped down: real evidence, no new gating on the
  // toggle itself) only once capacityTrend has genuinely established an
  // improving direction — never claims a trend off thin data, same
  // established-tier-only rule as every other capacityTrend read.
  const withFinisherNote = finisherApplied
    ? `${withObservations} ${
        trainingState && trainingState.capacityTrend.tier === 'established' && trainingState.capacityTrend.value === 'improving'
          ? "Added a finisher set to each exercise — you've been trending up, so there's real room for it."
          : 'Added a finisher set to each exercise.'
      }`
    : withObservations;

  // Same honesty rule as healthModifierChangedOutput above: only ever
  // stated when a trim actually happened (timeTrimmed), never claimed
  // just because a ceiling was passed in — a plan that already fit within
  // it needs no sentence. Exempt from the cap above for the same reason the
  // finisher note is: this confirms the user's own explicit time-budget
  // choice, not passive engine commentary.
  // "for" rather than "to fit" — trimming stops once assembleWorkout's own
  // total fits OR only 2 exercises remain (the real floor — see Step 4.5's
  // own comment for why it can't go lower), whichever comes first, so a
  // stubborn 2-exercise pair longer than the ceiling itself (e.g. two real
  // 5-minute holds against a shorter budget) can leave the result still
  // over. "For" stays true either way; "fit" wouldn't.
  const explanation = timeTrimmed
    ? `${withFinisherNote} Shortened for the ${timeAvailableMin} minutes you have today.`
    : withFinisherNote;

  // knownGaps THREADING (Vervein addition, not in the vault) — M8
  // (volume-scaling.ts) and M10 (workout-assembly.ts) have always computed
  // these honest, flagged-not-guessed diagnostic strings; nothing ever read
  // either array before this, so the "surfaced, not hidden" discipline both
  // modules' own header comments describe was true of their return values
  // and false of what actually happened to them one call up. Not intended
  // for end-user display (these read like engineering notes, e.g.
  // "adapted_duration_min rounded to 0 — Volume Scaling's own documented
  // gap...") — kept as real, inspectable data on the result plus a dev-only
  // console warning, the same audit-trail register policyApplications
  // already uses, not a new user-facing feature.
  const knownGaps = [...volumeKnownGaps, ...assemblyKnownGaps];
  if (__DEV__ && knownGaps.length > 0) {
    console.warn(`[plan-preview] ${knownGaps.length} known engine gap(s) fired:`, knownGaps);
  }

  // ScaledExercise doesn't carry body_area — zip against prioritizedFiltered
  // by index rather than a second by-id lookup, since scaleVolume's map()
  // preserves order 1:1 over exactly the list it was given (prioritizedFiltered,
  // not filterResult.filtered — see reorderByBodyAreaPriority's own comment on
  // why every order-dependent read below this point must agree). The Fallback
  // branch already returns full Exercise objects, which carry body_area directly.
  const exercises: PlanExercise[] = assembledExercises.map((ex, i) => {
    if ('exerciseId' in ex) {
      return {
        name: ex.name,
        sets: ex.adapted_sets,
        reps: ex.adapted_reps,
        durationMin: ex.adapted_duration_min,
        bodyArea: prioritizedFiltered[i]?.body_area ?? 'full',
        repStructure: prioritizedFiltered[i]?.rep_structure ?? 'discrete',
        intensity: prioritizedFiltered[i]?.intensity ?? null,
        isCompound: prioritizedFiltered[i]?.is_compound ?? null,
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
    constraints: dailyConstraints,
    overallSetsPct,
    knownGaps,
    trace: {
      fallbackFired: isRestDay,
      fallbackTrigger,
      gate1Exclusions: filterResult.gate1Exclusions,
      deliveredExercises,
      policyApplications,
    },
  };
}
