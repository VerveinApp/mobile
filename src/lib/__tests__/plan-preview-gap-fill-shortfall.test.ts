// Dedicated file, not folded into plan-preview.test.ts — same reasoning as
// plan-preview-stacking-transition.test.ts's own file-header comment: the
// jest.mock below overrides one field of filterAndSubstitute's real return
// value for every test in this file, which would corrupt every other
// plan-preview test if it lived in the shared file instead.
//
// WHY THIS NEEDS A MOCK AT ALL (different reason than the stacking-transition
// file's mock): gapFillShortfall > 0 is NOT permanently unreachable the way
// FD-3's stacking-transition signal is — exercise-filtering.ts's own type
// comment calls it "a real, allowed outcome," and it's real production
// behavior once a user's standing conditions/movementRestrictions plus
// today's acute symptom tags jointly exhaust the entire library's remaining
// candidate pool for whatever body areas survive. It's just impractical to
// reach through computePlanPreview's own realistic parameter surface for a
// deterministic unit test: an exhaustive search across every PROFILES fixture
// this suite uses, all 5 energy levels, and the full powerset of all 10 real
// acute symptom tags (15,360 real combinations) never produced a single
// gapFillShortfall > 0 result — the standing conditions/movementRestrictions
// fields that would be needed to push it over the edge live upstream, inside
// UserProfile → OnboardingContext, not in anything this function's own
// signature can set directly. Mocking filterAndSubstitute's numeric field
// (while still running the REAL implementation underneath for everything
// else — filtered/gate1Exclusions stay real) is the honest way to exercise
// plan-preview.ts's own sentence-building logic for a real, reachable value
// without fabricating a whole synthetic engine result.
jest.mock('@/lib/engine/exercise-filtering', () => {
  const actual = jest.requireActual('@/lib/engine/exercise-filtering');
  return {
    ...actual,
    filterAndSubstitute: jest.fn((...args: Parameters<typeof actual.filterAndSubstitute>) => ({
      ...actual.filterAndSubstitute(...args),
      gapFillShortfall: mockedShortfall,
    })),
  };
});

import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import type { UserProfile } from '@/lib/user-profile';

let mockedShortfall = 0;

const CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };

const FULL_GYM_PROFILE: Partial<UserProfile> = {
  goal: 'get-stronger',
  experience: 'experienced',
  environment: 'full-gym',
  days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
};

describe('computePlanPreview — gapFillShortfall observation (mocked, see file header)', () => {
  afterEach(() => {
    mockedShortfall = 0;
  });

  it('names the shortfall, singular, when exactly one slot could not be refilled', () => {
    mockedShortfall = 1;
    const result = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    expect(result.explanation).toContain('Today\'s constraints left 1 fewer exercise available than usual.');
  });

  it('names the shortfall, plural, when more than one slot could not be refilled', () => {
    mockedShortfall = 3;
    const result = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    expect(result.explanation).toContain('Today\'s constraints left 3 fewer exercises available than usual.');
  });

  it('stays silent on a real-scaling day when nothing was actually left unfilled', () => {
    mockedShortfall = 0;
    const result = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);
    expect(result.explanation).not.toContain('fewer exercise');
  });

  it('never fires on a Fallback (rest-day) session, even when the mocked shortfall is nonzero', () => {
    mockedShortfall = 2;
    const result = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 1, CALIBRATION);
    expect(result.trace.fallbackFired).toBe(true);
    expect(result.explanation).not.toContain('fewer exercise');
  });
});
