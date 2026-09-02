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
