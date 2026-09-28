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
 * SCOPE NOTE — symptom tags flow through here from two places: acute ones
 * picked fresh at each check-in (home/check-in.tsx) and standing ones set
 * once in Settings (ctx.standingSymptomTags — see symptom-tags.ts's
 * STANDING_SYMPTOM_TAGS). Both reach the daily constraint re-filter (M5) and
 * the volume multiplier chain (M8); standing ones also shape the baseline
 * itself (M3). Only acute ones get an explanation line — see Step 6. Still
 * unported: the full condition-profile / contraindication system (M2's
 * medical-condition half), which stays collect-only-never-gating per the
 * Chief Architect Audit's own C3 finding until a real validation process
 * exists — an empty array / neutral defaults below.
 */

import { generateBaselinePlan, type OnboardingContext } from '@/lib/engine/baseline-plan';
import { computeEffectiveConstraints } from '@/lib/engine/constraint-resolution';
import { buildExplanation, FINISHER_QUESTION } from '@/lib/engine/explanation-string';
import { filterAndSubstitute } from '@/lib/engine/exercise-filtering';
import { checkFallbackTrigger } from '@/lib/engine/fallback-logic';
import { ENERGY_MODIFIER_TABLE } from '@/lib/engine/reference/energy-modifier-table';
import { SYMPTOM_OVERRIDE_TABLE } from '@/lib/engine/reference/symptom-override-table';
import type { SymptomTag } from '@/lib/symptom-tags';
import type {
  BaselinePlan,
  BodyArea,
  DailyCheckIn,
  EffectiveConstraintSet,
  Equipment,
  Exercise,
  FallbackTrigger,
  PolicyApplicationRecord,
  RepStructure,
  ScaledExercise,
  ScaledExerciseList,
  UserCalibration,
} from '@/lib/engine/types';
import { recordPolicyApplications } from '@/lib/engine/policy-orchestration';
import { bodyAreaPriorityScore, type TrainingState } from '@/lib/engine/training-state';
import { scaleVolume } from '@/lib/engine/volume-scaling';
import { assembleWorkout } from '@/lib/engine/workout-assembly';
import { localDateStr } from '@/lib/local-date';
import { EQUIPMENT_BY_ENVIRONMENT, LOCAL_USER_ID, profileToOnboardingContext } from '@/lib/onboarding-to-engine';
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
   * What the optional finisher costs today, in minutes — known before it's
   * accepted, so the offer can name it up front. null whenever there's no
   * finisher to offer (any energy but 5, or a rest-day fallback).
   */
  finisherMinutes: number | null;
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
 * One more set of the same exercise, with that set's share of the block's
 * time added along with it. BUG FIX: the finisher used to add the set and
 * leave durationMin alone, so the session's total never moved — and for a
 * hold or carry, which the guided timer paces by splitting durationMin
 * across its sets (exercise-timer.ts), the extra set made every hold
 * shorter instead of adding any work (a 3-minute carry went from 60s a set
 * to 45s). Rounded to the nearest minute, but never less than one more —
 * rounding every exercise up instead overstated a 6-exercise finisher by
 * ~4 minutes, while plain rounding would call a short hold's extra set free.
 */
function addFinisherSet(ex: ScaledExercise): ScaledExercise {
  if (ex.adapted_sets === null) return ex;
  const sets = ex.adapted_sets;
  return {
    ...ex,
    adapted_sets: sets + 1,
    adapted_duration_min:
      ex.adapted_duration_min === null || ex.adapted_duration_min === 0
        ? ex.adapted_duration_min
        : Math.max(ex.adapted_duration_min + 1, Math.round((ex.adapted_duration_min * (sets + 1)) / sets)),
  };
}

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
 *
 * `preferredBodyArea` (Vervein addition) is the one deliberate exception to
 * "the engine decides, never the person" this reorder otherwise embodies —
 * an explicit, opt-in choice always wins over the computed neglected-area
 * signal, no tier check. Scoped specifically to check-in.tsx's rest-day
 * "check in anyway" path (see its own isRestDay gate): a day the engine
 * wasn't already planning to train at all is the one place honoring a
 * person's own stated preference over the algorithm's own guess doesn't
 * compete with this app's adaptive-plan identity for every OTHER day.
 */
function reorderByBodyAreaPriority(
  filtered: Exercise[],
  trainingState: TrainingState | undefined,
  preferredBodyArea?: BodyArea
): Exercise[] {
  if (preferredBodyArea) {
    return [...filtered].sort(
      (a, b) => (b.body_area === preferredBodyArea ? 1 : 0) - (a.body_area === preferredBodyArea ? 1 : 0)
    );
  }
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
//
// BUG FIX (caught while adding equipmentOverride): also keys on the
// effective equipment level, not just the profile reference. The pool
// itself is generated at this equipment ceiling (onboardingConstraints
// reads ctx.equipment) — without this, a day's real equipmentOverride could
// only ever TIGHTEN what Gate 1 re-filters out of an already-generated
// pool, never LOOSEN it, since the pool would still be capped at whatever
// the STANDING profile's equipment was regardless of today's real answer.
// It also fixes a real cross-contamination risk: check-in.tsx calls this
// twice per render with the SAME profile reference (`preview`, with
// whatever override is active, and `baseline`, deliberately without one) —
// a cache keyed on profile identity alone would serve one call's plan to
// the other whenever they disagree on equipment.
// Also keys on the effective simple-exercise bias, same reasoning and same
// bug class as the equipment key above — a real return-after-absence
// (daysSinceLastCheckIn) can flip this to true for a session even when the
// standing profile's own experience level wouldn't, and the pool itself
// (not just the daily re-filter) needs to reflect that, or check-in.tsx's
// own `preview`-vs-`baseline` pair could contaminate each other again.
let cachedProfileInput: PlanPreviewInput | null = null;
let cachedEquipment: Equipment | null = null;
let cachedBiasSimpleExercises: boolean | null = null;
let cachedBaselinePlan: BaselinePlan | null = null;

function getBaselinePlanCached(
  input: PlanPreviewInput,
  ctx: OnboardingContext,
  effectiveEquipment: Equipment,
  effectiveBiasSimpleExercises: boolean
): BaselinePlan {
  if (
    input === cachedProfileInput &&
    effectiveEquipment === cachedEquipment &&
    effectiveBiasSimpleExercises === cachedBiasSimpleExercises &&
    cachedBaselinePlan
  ) {
    return cachedBaselinePlan;
  }
  cachedProfileInput = input;
  cachedEquipment = effectiveEquipment;
  cachedBiasSimpleExercises = effectiveBiasSimpleExercises;
  cachedBaselinePlan = generateBaselinePlan(
    { ...ctx, equipment: effectiveEquipment, biasSimpleExercises: effectiveBiasSimpleExercises },
    LOCAL_USER_ID
  );
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
   * top of that, not itself bounded by it. Its time is counted, though (see
   * addFinisherSet), and a finisher that takes the session past the chosen
   * time says so rather than quietly overrunning it.
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
  healthReadinessReasons?: { rhrElevated: boolean; sleepDeficit: boolean },
  /**
   * Vervein addition, not in the vault — an explicit body-area choice from
   * check-in.tsx's rest-day "check in anyway" flow only (see that screen's
   * own isRestDay gate). Undefined on every other call site/day, byte-
   * identical to today's existing behavior. See reorderByBodyAreaPriority's
   * own doc comment for why this is allowed to override the engine's own
   * neglected-area signal specifically here and nowhere else.
   */
  preferredBodyArea?: BodyArea,
  /**
   * Vervein addition, not in the vault — check-in.tsx's own "Where are you
   * working out today?" answer, in the same onboarding-vocabulary keys
   * ('full-gym'/'home-gym'/'minimal-equipment'/'bodyweight-only') the
   * profile's own standing `environment` answer uses, mapped through the
   * exact same EQUIPMENT_BY_ENVIRONMENT table onboarding-to-engine.ts
   * already applies to that standing answer. Undefined means today's
   * equipment matches the standing profile, byte-identical to every call
   * site that doesn't pass one. Unlike the safety-driven ceilings above
   * (intensity/impact, tightened only, never loosened — Most Restrictive
   * Wins), equipment is an availability fact, not a safety limit, so a
   * day's real answer fully REPLACES the standing one, in either direction
   * — someone traveling has real LESS equipment than home; someone at a
   * hotel gym for the day has real MORE. Same full-override precedent as
   * preferredBodyArea above, for the same reason: this is the one input
   * where what the person reports today is more true than a standing
   * onboarding answer could be.
   */
  equipmentOverride?: string
): PlanPreviewResult {
  const ctx = profileToOnboardingContext(input);
  const effectiveEquipment = equipmentOverride ? (EQUIPMENT_BY_ENVIRONMENT[equipmentOverride] ?? ctx.equipment) : ctx.equipment;
  // Vervein addition — a real return-after-absence biases toward simpler,
  // more familiar exercises for that one session, the same real mechanism
  // ctx.biasSimpleExercises already gives a beginner (see baseline-plan.ts's
  // own bySelectionOrder — a soft preference ordering, never a hard filter,
  // so nothing becomes unselectable, just reordered behind). daysSinceLast
  // CheckIn already gates the "welcome back" explanation wording below at
  // this exact same RETURN_GAP_MIN_DAYS threshold; this is the same real
  // detection now also touching what gets selected, not just what gets said.
  const effectiveBiasSimpleExercises =
    ctx.biasSimpleExercises || (daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn >= RETURN_GAP_MIN_DAYS);
  const baselinePlan = getBaselinePlanCached(input, ctx, effectiveEquipment, effectiveBiasSimpleExercises);

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
    effectiveEquipment,
    ctx.conditions
  );
  const filterResult = filterAndSubstitute(baselinePlan, dailyConstraints, effectiveBiasSimpleExercises);
  // Body-area priority reorder (Vervein addition — see the function's own
  // doc comment). Every downstream use of "today's eligible exercises in
  // order" reads this, not filterResult.filtered directly, so the reorder
  // stays consistent across volume scaling, the trim step, and the final
  // per-exercise metadata zip below — a partial reorder (some call sites
  // updated, others not) would silently misalign body areas by index.
  const prioritizedFiltered = reorderByBodyAreaPriority(filterResult.filtered, trainingState, preferredBodyArea);
  const prioritizedArea =
    prioritizedFiltered[0] && filterResult.filtered[0] && prioritizedFiltered[0].body_area !== filterResult.filtered[0].body_area
      ? prioritizedFiltered[0].body_area
      : null;

  // Standing ∪ acute, deduplicated — the same merge M13 does before both
  // the volume-scaling multiplier lookup and the explanation's tag lines.
  const activeTags = [...new Set([...ctx.standingSymptomTags, ...acuteSymptomTags])];
  // Cast, not a type-level guarantee — same reasoning as constraint-
  // resolution.ts's identical cast. .filter(Boolean) (not a throw) is this
  // call site's own existing, pre-existing behavior for an unrecognized
  // tag — unchanged by this cast.
  const activeSymptomOverrides = activeTags.map((t) => SYMPTOM_OVERRIDE_TABLE[t as SymptomTag]).filter(Boolean);

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
  // Set alongside finisherApplied (Step 4.6) — see PlanPreviewResult's own
  // field comment.
  let finisherMinutes: number | null = null;
  // The total before the finisher's sets were added, for the explanation's
  // time sentence — only differs from workout.totalDuration once it's applied.
  let durationBeforeFinisher = 0;
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
      // Its cost is computed whether or not it's accepted, so the offer can
      // name it before anyone says yes.
      durationBeforeFinisher = assembleWorkout(trimmedExercises, false).workout.totalDuration;
      const withFinisherSets = energy === 5 ? trimmedExercises.map(addFinisherSet) : null;
      if (withFinisherSets) {
        finisherMinutes = assembleWorkout(withFinisherSets, false).workout.totalDuration - durationBeforeFinisher;
      }
      finisherApplied = withFinisherSets !== null && finisherAccepted === true;
      assembledExercises = finisherApplied && withFinisherSets ? withFinisherSets : trimmedExercises;

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

  // Step 6 — explanation. Acute tags only: a standing one is a setting,
  // like a movement restriction, and gets no line of its own — the vault
  // restates it every day, and a TAG_LINES sentence ("…today") repeated
  // daily for something set once reads as nagging and buries what actually
  // changed today. Settings' Ongoing Symptoms sheet says what each does.
  const todaysTags = [...new Set(acuteSymptomTags)].filter((t) => !ctx.standingSymptomTags.includes(t));
  const { explanation: rawBaseExplanation } = buildExplanation(
    energy,
    todaysTags,
    calibration,
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
  // Two different real causes can move the same first exercise — the
  // computed neglected-area signal above, or (rest-day "check in anyway"
  // only) an explicit preferredBodyArea. Reusing "exactly what you asked
  // for" for the first case would be a real inaccuracy: nothing about a
  // self-chosen bonus session applies to a signal the person never touched.
  //
  // BUG FIX: this used to read "it's fallen behind the rest lately" — a
  // debt/guilt framing (this app's own bodyAreaPriorityScore literally
  // calls the underlying field stimulusDebt) for what the physiology
  // actually is: a body area that hasn't been loaded in a while is
  // RECOVERED, not neglected. Same real signal, opposite emotional
  // valence — "well-rested" is the more honest read of what long recency
  // means, not just the kinder one, and it's this app's own explicit stance
  // against any "you're behind" framing (see the vault's own no-streaks
  // rule this already lives alongside). Observation only, never a command —
  // this states which area led the order, not that the user should train it.
  if (prioritizedArea && preferredBodyArea && prioritizedArea === preferredBodyArea) {
    observations.push(`Started with ${BODY_AREA_PRIORITY_LABEL[prioritizedArea]} — exactly what you asked for today.`);
  } else if (prioritizedArea) {
    observations.push(`Started with ${BODY_AREA_PRIORITY_LABEL[prioritizedArea]} — it's well-rested and ready for more.`);
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
  // Once accepted, the template's own question has been answered: drop it
  // rather than asking and confirming in the same breath.
  const withFinisherNote = finisherApplied
    ? `${withObservations.replace(` ${FINISHER_QUESTION}`, '')} ${
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
  //
  // A finisher can take a session that fit back over the chosen time — it's
  // added after the trim, on purpose (more work was asked for, so nothing
  // is cut to make room). Said plainly rather than left for the person to
  // discover mid-workout. Only when the finisher is what pushed it over:
  // a 2-exercise floor that was already over (see "for" above) isn't the
  // finisher's doing.
  const finisherRunsOver =
    finisherApplied &&
    timeAvailableMin !== undefined &&
    durationBeforeFinisher <= timeAvailableMin &&
    workout.totalDuration > timeAvailableMin;
  const timeNote = finisherRunsOver
    ? timeTrimmed
      ? ` Shortened for the ${timeAvailableMin} minutes you have today — the finisher takes it to ${workout.totalDuration}.`
      : ` The finisher takes it to ${workout.totalDuration} minutes, past the ${timeAvailableMin} you have today.`
    : timeTrimmed
      ? ` Shortened for the ${timeAvailableMin} minutes you have today.`
      : '';
  const explanation = `${withFinisherNote}${timeNote}`;

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

  // BUG FIX (caught while adding equipmentOverride): this always read the
  // standing profile's environment, regardless of today's own override —
  // on a day the override was active, this would have kept naming the
  // standing setup even though a genuinely different one governed which
  // exercises actually got selected. Names whichever one was real for today.
  //
  // BUG FIX #2 (found in a later full-app audit): this originally branched
  // on equipmentOverride's bare truthiness, not on whether it actually
  // resolved to a real Equipment value the way effectiveEquipment itself
  // does above. For a value absent from EQUIPMENT_BY_ENVIRONMENT (stale
  // data from an older backup, or a value the environment type gained
  // before a table entry existed for it), effectiveEquipment already
  // correctly falls back to the standing ctx.equipment — but this note
  // would still say "today's [equipment fallback label]" while the
  // standing setup was what actually governed selection. Gated on the same
  // resolved lookup effectiveEquipment uses, so the two can never disagree.
  const resolvedOverrideLabel = equipmentOverride ? ENVIRONMENT_LABELS[equipmentOverride] : undefined;
  const equipmentNote = resolvedOverrideLabel
    ? `Selected from today's ${resolvedOverrideLabel} setup.`
    : `Selected from your ${ENVIRONMENT_LABELS[input.environment ?? ''] ?? 'equipment'} setup.`;

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
    finisherMinutes,
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
