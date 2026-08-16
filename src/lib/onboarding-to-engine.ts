/**
 * The mapping layer the research vault never had to write, because its own
 * onboarding-intake module (M1) was designed against its own 12-screen
 * spec — targetIntensity/equipment/focusAreas collected directly, plus a
 * condition/symptom/movement-restriction screen set this app doesn't have.
 * Vervein's actual onboarding asks different questions (goal/experience/
 * environment/duration/days/commitment), so this file is the real,
 * previously-nonexistent translation between what this app collects and
 * what generateBaselinePlan (src/lib/engine/baseline-plan.ts) expects.
 *
 * Every mapping below is a named design decision, not a guess buried in
 * code — see the comment on each. Two are worth calling out up front:
 *
 * - focusAreas is always ['full']. Vervein's onboarding never asks which
 *   body area to prioritize (unlike the vault's own Screen 3), so the only
 *   honest choice is "train everything," not fabricating a per-goal split
 *   the user was never actually asked about.
 * - conditions / standingSymptomTags / movementRestrictions are always [].
 *   The condition-gating modules (M2, M5) haven't been ported — two Chief
 *   Architect Audit findings (unvalidated hard-safety filters, missing
 *   consent-schema representation) are still open against that part of the
 *   vault's design, so this app doesn't collect or apply that data yet.
 *   See baseline-plan.ts's own doc comment for the same scope boundary.
 */

import type { ConstraintProfile, Equipment, FocusArea, Intensity, SessionDay } from '@/lib/engine/types';
import type { OnboardingContext } from '@/lib/engine/baseline-plan';
import type { UserProfile } from '@/lib/user-profile';

// There's no account system in this app (local-only, no backend) — every
// generateBaselinePlan call is scoped to the one profile on-device, so a
// fixed label is honest; it's not standing in for a real multi-user id.
export const LOCAL_USER_ID = 'local-user';

const EQUIPMENT_BY_ENVIRONMENT: Record<string, Equipment> = {
  'full-gym': 'full_gym',
  // A home gym in this app's onboarding copy means "some equipment, not a
  // commercial rack" — the engine's middle tier, not its top one.
  'home-gym': 'minimal',
  'minimal-equipment': 'minimal',
  'bodyweight-only': 'none',
};

// Same "more experience → can handle more" direction plan-preview.ts's own
// EXPERIENCE_BASE table already uses — kept consistent with that existing,
// already-considered judgment rather than inventing a second one.
const INTENSITY_BY_EXPERIENCE: Record<string, Intensity> = {
  'just-starting': 'low',
  'trained-before': 'medium',
  'train-regularly': 'medium',
  'years-experience': 'high',
};

// Same values plan-preview.ts's BASE_DURATION_MIN_BY_BUCKET already uses.
const SESSION_MIN_BY_DURATION: Record<string, number> = {
  'under-30': 25,
  '30-45': 38,
  '45-60': 52,
  '60-plus': 65,
};

const DAY_NAME_TO_SESSION_DAY: Record<string, SessionDay> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

/**
 * commitmentLevel (1–8, see commitment-levels.ts) is the closest thing this
 * app collects to "how much capacity for progression/volume" — mapped to
 * thirds rather than a finer split, since 8 discrete commitment levels
 * mapping to 3 progressionSpeed/volumeStance tiers is already more
 * resolution than either field's actual (currently unread — see
 * baseline-plan.ts) downstream use would meaningfully use.
 */
function constraintProfileFor(profile: UserProfile): ConstraintProfile {
  const commitment = Number(profile.commitmentLevel) || 4;
  const progressionSpeed = commitment >= 7 ? 'fast' : commitment >= 4 ? 'moderate' : 'slow';
  const volumeStance = commitment >= 4 ? 'standard' : 'conservative';

  return {
    // Neither recoverySensitivity nor fatigueVariability has a source in
    // what Vervein collects — both are real Condition Profile (M2) outputs
    // this app doesn't derive. "medium" is a neutral placeholder, not a
    // measured value; like preferredSessionMin, neither field is actually
    // read by the modules this app has ported (M3/M6) as of this port.
    recoverySensitivity: 'medium',
    fatigueVariability: 'medium',
    progressionSpeed,
    preferredSessionMin: SESSION_MIN_BY_DURATION[profile.duration ?? ''] ?? 38,
    // No condition/injury data is collected yet (see this file's own top
    // comment), so there's no real signal to base a restriction on — the
    // honest default is the most permissive ceiling, not a fabricated one.
    impactCeiling: 'high',
    volumeStance,
  };
}

/** Vervein UserProfile → the engine's OnboardingContext. Pure, synchronous, no I/O. */
export function profileToOnboardingContext(profile: UserProfile): OnboardingContext {
  const focusAreas: FocusArea[] = ['full'];
  const sessionDays: SessionDay[] = (profile.days ?? '')
    .split(',')
    .map((d) => DAY_NAME_TO_SESSION_DAY[d.trim()])
    .filter((d): d is SessionDay => d !== undefined);

  return {
    targetIntensity: INTENSITY_BY_EXPERIENCE[profile.experience ?? ''] ?? 'medium',
    equipment: EQUIPMENT_BY_ENVIRONMENT[profile.environment ?? ''] ?? 'minimal',
    focusAreas,
    sessionDays,
    conditionProfile: constraintProfileFor(profile),
    conditions: [],
    standingSymptomTags: [],
    movementRestrictions: [],
  };
}
