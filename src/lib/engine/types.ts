// Shared types — ported verbatim from the adaptive-engine research vault's
// src/models/types.ts (traces to "Adaptive Decision Engine — Public Interface
// Specification.md" §1). Kept as a full, untrimmed port — even the types not
// yet consumed by the modules ported so far (baseline-plan.ts,
// exercise-filtering.ts, exercise-library.ts) — so this file stays a 1:1
// mirror of the source rather than a hand-picked subset that could silently
// drift from it. Only cost of the unused types: zero, since TS types erase
// at compile time.

export type Intensity = 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';
export type Equipment = 'none' | 'minimal' | 'full_gym';
export type BodyArea = 'full' | 'upper' | 'lower' | 'core';
export type FocusArea = 'upper' | 'lower' | 'core' | 'full';
export type SessionDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type VolumeStance = 'conservative' | 'standard';
export type MovementPattern =
  | 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'plank'
  | 'rotate' | 'jump' | 'overhead' | 'kneel' | 'floor' | 'run';
export type RepStructure = 'discrete' | 'isometric_hold' | 'loaded_carry';
export type RomDemand = 'partial' | 'moderate' | 'full';
export type FeedbackResponse = 'too_easy' | 'just_right' | 'too_hard';
export type PolicyId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type PolicyStatus = 'ran-interim' | 'no-mechanism-v1' | 'deferred-v1.1';
export type FallbackTrigger = 'empty-filter' | 'energy-1' | 'p5-stacking-transition';

export type OnboardingOutput = {
  primaryGoal: string; // cosmetic only — never read by any Layer 3 module
  targetIntensity: Intensity;
  equipment: Equipment;
  focusAreas: FocusArea[];
  sessionDays: SessionDay[];
  conditions: string[];
  standingSymptomTags: string[];
  movementRestrictions: string[];
};

export type ConstraintProfile = {
  recoverySensitivity: 'low' | 'medium' | 'high';
  fatigueVariability: 'low' | 'medium' | 'high';
  progressionSpeed: 'slow' | 'moderate' | 'fast';
  preferredSessionMin: number;
  impactCeiling: Impact;
  volumeStance: VolumeStance;
};

export type BaselinePlan = {
  userId: string;
  sessionDays: SessionDay[];
  exerciseIds: string[];
  targetIntensity: Intensity;
  equipment: Equipment;
  focusAreas: FocusArea[];
};

export type DailyCheckIn = {
  userId: string;
  date: string;
  energyScore: 1 | 2 | 3 | 4 | 5;
  acuteSymptomTags: string[];
  skipped: boolean;
};

export type EffectiveConstraintSet = {
  intensityCeiling: Intensity;
  impactCeiling: Impact;
  equipmentCeiling: Equipment;
  excludeBodyAreas: BodyArea[];
  excludeMovementPatterns: MovementPattern[];
  forceAddTypes: string[];
  // Founder-approved interface amendment (2026-07-22, Decision Log): the
  // user's selected conditions, carried so M6 can execute the library's
  // contraindications field as the hard Gate 1 exclusion the Condition Prior
  // notes already define. Exposing already-approved data, not a new policy.
  excludeContraindicatedFor: string[];
};

export type Exercise = {
  id: string;
  name: string;
  type: 'strength' | 'power' | 'mobility' | 'recovery' | 'cardio';
  intensity: Intensity | null;
  impact: Impact;
  body_area: BodyArea;
  complexity: 'simple' | 'moderate';
  equipment: Equipment;
  movement_patterns: MovementPattern[];
  rep_structure: RepStructure;
  is_compound: 'compound' | 'accessory' | null;
  laterality: 'unilateral' | 'bilateral';
  rom_demand: RomDemand | null;
  loads_lengthened: boolean | null;
  base_sets: number | null;
  base_reps: number | string | null;
  base_duration_min: number | null;
  contraindications: string[]; // condition IDs this exercise is hard-excluded for (Gate 1)
  active: boolean;
};

export type FilteredExerciseList = Exercise[];

export type ScaledExercise = {
  exerciseId: string;
  name: string;
  adapted_sets: number | null;
  adapted_reps: number | string | null;
  adapted_duration_min: number | null;
  laterality: 'unilateral' | 'bilateral';
};
export type ScaledExerciseList = ScaledExercise[];

export type FallbackResult = {
  exercises: [Exercise, Exercise];
  isRestDay: true;
  trigger: FallbackTrigger;
};

export type PolicyApplicationRecord = {
  policy: PolicyId;
  status: PolicyStatus;
  detail: string;
};

export type AdaptedWorkout = {
  exercises: ScaledExerciseList | [Exercise, Exercise];
  totalDuration: number;
  isRestDay: boolean;
};

export type DecisionTrace = {
  inputSnapshot: {
    energyScore: 1 | 2 | 3 | 4 | 5;
    activeSymptomTags: string[];
    conditionProfile: ConstraintProfile;
    movementRestrictions: string[];
    baselinePlanId: string;
    calibrationMultiplierUsed: number;
  };
  gate1Exclusions: {
    exerciseId: string;
    excludedBy: 'safety' | 'restriction' | 'symptom-hard-exclude' | 'condition-ceiling' | 'equipment' | 'intensity' | 'impact' | 'body-area' | 'contraindication' | 'inactive';
  }[];
  gate2Applications: PolicyApplicationRecord[];
  output: AdaptedWorkout;
  explanationMapping: { reduction: string; template: string | null }[];
  fallbackFired: boolean;
  knownGapsSurfaced: string[]; // honesty channel — see the engine's own README "Known gaps this demo surfaces"
  colCitation?: string;
  // FE-13 (graduated 2026-07-22): the derived TrainingState this run read, if
  // one was supplied — recorded so every longitudinal influence is auditable.
  // Absent = the run was history-blind (pre-compiler behavior, still valid).
  trainingStateUsed?: unknown;
};

export type UserCalibration = {
  userId: string;
  multiplier: number;
  sampleCount: number;
};

export type WorkoutFeedback = {
  workoutId: string;
  response: FeedbackResponse;
};

export type DeloadNudge = {
  triggered: boolean;
  message: string | null;
};

/**
 * RuntimeContext — Host Runtime Context Integration (2026-07-22).
 *
 * The engine never reads the operating-system clock, a timezone API, or a
 * locale API. The host application (this app, in this port) gathers this
 * shape once, from real device/OS APIs, and passes it in immutably. The
 * engine trusts it, never verifies it, never mutates it.
 */
export type RuntimeContext = {
  clock: {
    timestamp: string; // full ISO 8601 instant, e.g. "2026-07-22T09:00:00-05:00"
    timezone: string; // IANA timezone, e.g. "America/Chicago"
    localDate: string; // YYYY-MM-DD — the host's computed local calendar date
    dayOfWeek: SessionDay;
    utcOffsetMinutes: number;
  };
  device?: {
    locale: string;
  };
};
