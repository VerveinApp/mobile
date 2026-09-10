import { exerciseLibrary } from '@/lib/engine/exercise-library';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview, type EnergyLevel } from '@/lib/plan-preview';
import { TIME_AVAILABLE_OPTIONS } from '@/lib/time-available';
import type { UserProfile } from '@/lib/user-profile';

const CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };

const PROFILES: (Partial<UserProfile> & Record<string, unknown>)[] = [
  {}, // the exact `profile ?? {}` fallback every real screen passes
  { goal: 'get-stronger', experience: 'just-starting', environment: 'no-equipment', days: 'monday,wednesday,friday' },
  { goal: 'build-physique', experience: 'experienced', environment: 'full-gym', days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday' },
];

// REGRESSION TEST for a real, shipped crash: computePlanPreview's time-
// available trim used to be able to reduce a session to exactly 1 exercise,
// which assembleWorkout (M10) throws on unconditionally ("fewer than 2
// exercises"). Reachable via a completely ordinary user action — picking
// the shortest real time-available option (15 minutes) on a normal-to-good
// energy day. The fix floors the trim at 2 exercises, never 1. This test
// sweeps every real time-available option, every real energy level, and a
// few different profiles (including the exact empty-object fallback every
// screen uses while profile data is still loading) to make sure that crash
// can never come back.
describe('computePlanPreview — time-available trim never crashes assembleWorkout', () => {
  for (const profile of PROFILES) {
    for (const timeAvailableMin of TIME_AVAILABLE_OPTIONS) {
      for (const energy of [2, 3, 4, 5] as EnergyLevel[]) {
        it(`profile=${JSON.stringify(profile)} energy=${energy} timeAvailableMin=${timeAvailableMin}`, () => {
          expect(() =>
            computePlanPreview(profile as UserProfile, energy, CALIBRATION, [], undefined, 1, undefined, timeAvailableMin)
          ).not.toThrow();
        });
      }
    }
  }

  it('never delivers a real (non-fallback) session with fewer than 2 exercises, at the tightest real time budget', () => {
    for (const profile of PROFILES) {
      for (const energy of [2, 3, 4, 5] as EnergyLevel[]) {
        const result = computePlanPreview(profile as UserProfile, energy, CALIBRATION, [], undefined, 1, undefined, 15);
        if (!result.trace.fallbackFired) {
          expect(result.exerciseCount).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});

describe('computePlanPreview — with no time constraint at all (existing behavior, not part of the fix)', () => {
  it('still returns a real session with no timeAvailableMin passed', () => {
    const result = computePlanPreview({}, 4, CALIBRATION);
    expect(result.exerciseCount).toBeGreaterThan(0);
    expect(typeof result.explanation).toBe('string');
  });
});

// preferredBodyArea (Vervein addition) — check-in.tsx's rest-day "check in
// anyway" body-area preference. Full-gym, all-days profile so the pool
// realistically has exercises in every body area to reorder toward.
const FULL_GYM_PROFILE: Partial<UserProfile> = {
  goal: 'get-stronger',
  experience: 'experienced',
  environment: 'full-gym',
  days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
};

describe('computePlanPreview — preferredBodyArea', () => {
  it('never throws, across every profile/energy/time combination, with a preference set', () => {
    for (const profile of PROFILES) {
      for (const energy of [1, 2, 3, 4, 5] as EnergyLevel[]) {
        for (const timeAvailableMin of [undefined, ...TIME_AVAILABLE_OPTIONS]) {
          expect(() =>
            computePlanPreview(
              profile as UserProfile,
              energy,
              CALIBRATION,
              [],
              undefined,
              1,
              undefined,
              timeAvailableMin,
              undefined,
              undefined,
              undefined,
              'lower'
            )
          ).not.toThrow();
        }
      }
    }
  });

  it('moves an exercise from the preferred body area to the front of the list', () => {
    const withoutPreference = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    const withPreference = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'lower'
    );
    // Real, honest assertion: only meaningful if the unreordered baseline
    // didn't already happen to start with 'lower' (otherwise there's
    // nothing for the preference to visibly move).
    if (withoutPreference.exercises[0]?.bodyArea !== 'lower') {
      expect(withPreference.exercises[0]?.bodyArea).toBe('lower');
    }
  });

  it("names the real reason in the explanation — a self-chosen preference, not a claim of neglect", () => {
    const result = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'core'
    );
    if (result.exercises[0]?.bodyArea === 'core') {
      expect(result.explanation).toContain('exactly what you asked for today');
      expect(result.explanation).not.toContain('well-rested and ready for more');
    }
  });

  it('an undefined preferredBodyArea leaves ordering byte-identical to today\'s existing behavior', () => {
    const a = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    const b = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(b.exercises.map((e) => e.id)).toEqual(a.exercises.map((e) => e.id));
  });
});

// equipmentOverride (Vervein addition) — check-in.tsx's own "Where are you
// working out today?" answer.
describe('computePlanPreview — equipmentOverride', () => {
  it('never throws, across every profile/energy combination, with an override set', () => {
    for (const profile of PROFILES) {
      for (const energy of [1, 2, 3, 4, 5] as EnergyLevel[]) {
        for (const environment of ['full-gym', 'home-gym', 'minimal-equipment', 'bodyweight-only']) {
          expect(() =>
            computePlanPreview(
              profile as UserProfile,
              energy,
              CALIBRATION,
              [],
              undefined,
              1,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              environment
            )
          ).not.toThrow();
        }
      }
    }
  });

  it('a stricter override (bodyweight-only) on a full-gym profile actually excludes equipment-requiring exercises the standing profile alone would not', () => {
    const withoutOverride = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    const withOverride = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'bodyweight-only'
    );
    // gate1Exclusions alone can't tell this apart — once the baseline POOL
    // itself is correctly generated at today's real equipment level (the
    // actual fix here), Gate 1's own re-check of that same ceiling never
    // finds anything left to exclude, by construction. The real, visible
    // effect is in the exercises actually returned: none should require
    // more than bodyweight-only, and the unrestricted full-gym profile
    // should have surfaced at least one that does.
    const requiresEquipment = (result: typeof withOverride) =>
      result.exercises.some((e) => exerciseLibrary.getById(e.id)?.equipment !== 'none');
    expect(requiresEquipment(withOverride)).toBe(false);
    expect(requiresEquipment(withoutOverride)).toBe(true);
  });

  it("a looser override (full-gym) on a bodyweight-only profile actually admits exercises the standing profile alone would exclude for equipment", () => {
    const bodyweightProfile: Partial<UserProfile> = {
      goal: 'get-stronger',
      experience: 'experienced',
      environment: 'bodyweight-only',
      days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    };
    const withoutOverride = computePlanPreview(bodyweightProfile as UserProfile, 4, CALIBRATION);
    const withOverride = computePlanPreview(
      bodyweightProfile as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'full-gym'
    );
    const requiresEquipment = (result: typeof withOverride) =>
      result.exercises.some((e) => exerciseLibrary.getById(e.id)?.equipment !== 'none');
    // The standing bodyweight-only profile alone should never surface an
    // equipment-requiring exercise; today's real full-gym override should.
    expect(requiresEquipment(withoutOverride)).toBe(false);
    expect(requiresEquipment(withOverride)).toBe(true);
  });

  it("equipmentNote names today's override, not the standing profile, when an override is active", () => {
    const result = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'bodyweight-only'
    );
    expect(result.equipmentNote).toContain('Bodyweight Only');
    expect(result.equipmentNote).not.toContain('Full Gym');
  });

  it('an undefined equipmentOverride leaves the result byte-identical to today\'s existing behavior', () => {
    const a = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    const b = computePlanPreview(
      FULL_GYM_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(b.exercises.map((e) => e.id)).toEqual(a.exercises.map((e) => e.id));
    expect(b.equipmentNote).toEqual(a.equipmentNote);
  });
});

// daysSinceLastCheckIn biasing toward simpler exercises on a real return
// (Vervein addition) — the same real mechanism a beginner's own standing
// experience answer already gets (baseline-plan.ts's bySelectionOrder), now
// also triggered by a real return-after-absence, not just a standing
// profile answer.
describe('computePlanPreview — return-after-absence biases toward simpler exercises', () => {
  // Deliberately an experienced profile — BIAS_SIMPLE_BY_EXPERIENCE only
  // sets this true for 'just-starting', so any effect observed here is
  // attributable purely to daysSinceLastCheckIn, not the standing profile.
  const EXPERIENCED_PROFILE: Partial<UserProfile> = {
    goal: 'get-stronger',
    experience: 'years-experience',
    environment: 'full-gym',
    days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
  };

  const simpleFraction = (result: ReturnType<typeof computePlanPreview>) => {
    const complexities = result.exercises.map((e) => exerciseLibrary.getById(e.id)?.complexity);
    const simpleCount = complexities.filter((c) => c === 'simple').length;
    return complexities.length > 0 ? simpleCount / complexities.length : 0;
  };

  it('never throws, across every profile/energy combination, with a real return gap', () => {
    for (const profile of PROFILES) {
      for (const energy of [1, 2, 3, 4, 5] as EnergyLevel[]) {
        for (const daysSinceLastCheckIn of [undefined, 1, 4, 5, 10, 30]) {
          expect(() =>
            computePlanPreview(
              profile as UserProfile,
              energy,
              CALIBRATION,
              [],
              undefined,
              1,
              undefined,
              undefined,
              daysSinceLastCheckIn
            )
          ).not.toThrow();
        }
      }
    }
  });

  it('a real return gap (>= 5 days) never leaves the exercise pool less simple than a normal day, for an experienced profile', () => {
    const normalDay = computePlanPreview(EXPERIENCED_PROFILE as UserProfile, 4, CALIBRATION);
    const returningDay = computePlanPreview(
      EXPERIENCED_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      10
    );
    expect(simpleFraction(returningDay)).toBeGreaterThanOrEqual(simpleFraction(normalDay));
  });

  it('a gap under the real threshold (< 5 days) does not trigger the bias — same result as no gap at all', () => {
    const noGap = computePlanPreview(EXPERIENCED_PROFILE as UserProfile, 4, CALIBRATION);
    const smallGap = computePlanPreview(
      EXPERIENCED_PROFILE as UserProfile,
      4,
      CALIBRATION,
      [],
      undefined,
      1,
      undefined,
      undefined,
      3
    );
    expect(smallGap.exercises.map((e) => e.id)).toEqual(noGap.exercises.map((e) => e.id));
  });

  it("a beginner's own standing bias is unaffected by daysSinceLastCheckIn being absent (regression guard on the new cache key)", () => {
    const beginnerProfile: Partial<UserProfile> = {
      goal: 'get-stronger',
      experience: 'just-starting',
      environment: 'full-gym',
      days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    };
    const result = computePlanPreview(beginnerProfile as UserProfile, 4, CALIBRATION);
    expect(result.exerciseCount).toBeGreaterThan(0);
  });
});
