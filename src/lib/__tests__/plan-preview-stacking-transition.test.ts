// Dedicated file, not folded into plan-preview.test.ts — the jest.mock below
// replaces volume-scaling.ts's real scaleVolume for every test in this file,
// which would corrupt every other plan-preview test if it lived in the
// shared file instead.
//
// WHY THIS NEEDS A MOCK AT ALL: volume-scaling.ts's own FD-3 gap (see that
// module's header comment) always evaluates `stackingTransition` to `false`
// — scaleVolume can never actually return `{ kind: 'stacking-transition-
// signal' }` through any real input today. plan-preview.ts's own comment on
// this branch says exactly that: "Unreachable today ... but handled for
// type-safety and so this stays a faithful mirror of M13's real branch if
// that gap is ever resolved." A branch that's unreachable via real inputs
// by design can only be exercised by mocking its one upstream signal —
// this is defensive-code coverage, not a claim that this path fires today.
jest.mock('@/lib/engine/volume-scaling', () => ({
  scaleVolume: jest.fn(() => ({ kind: 'stacking-transition-signal', knownGaps: ['mocked FD-3 signal for coverage'] })),
}));

import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview } from '@/lib/plan-preview';
import type { UserProfile } from '@/lib/user-profile';

const CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };

const FULL_GYM_PROFILE: Partial<UserProfile> = {
  goal: 'get-stronger',
  experience: 'experienced',
  environment: 'full-gym',
  days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
};

describe('computePlanPreview — M8 stacking-transition-signal branch (mocked, see file header)', () => {
  it('falls through to the second fallback pathway, matching the p5-stacking-transition trigger, when scaleVolume signals it', () => {
    // energy=4 (not 1) and a full-gym profile so the FIRST fallback check
    // (checkFallbackTrigger(..., false) above scaleVolume) never fires —
    // this test is specifically about the SECOND fallback check, the one
    // gated on the mocked stacking-transition-signal.
    const result = computePlanPreview(FULL_GYM_PROFILE as UserProfile, 4, CALIBRATION);

    expect(result.trace.fallbackFired).toBe(true);
    expect(result.trace.fallbackTrigger).toBe('p5-stacking-transition');
    // Same force-assigned recovery pair every fallback pathway uses
    // (fallback-logic.ts's ex_1023/ex_1083) — the stacking-transition branch
    // is documented as delivering the exact same output as Energy Score 1,
    // not a different or partial recovery session.
    expect(result.exercises.map((e) => e.id).sort()).toEqual(['ex_1023', 'ex_1083']);
    // M8 (scaleVolume) genuinely ran before this branch fired — plan-
    // preview.ts's own comment says the P5 record must say so here, unlike
    // the first-fallback branch where P5 never executed at all.
    const p5Record = result.trace.policyApplications.find((r) => r.policy === 'P5');
    expect(p5Record?.detail).toBe('Multiplication interim executed via M8. Stacking-transition fired: true.');
    // The mocked signal's own knownGaps must still surface, same as a real
    // 'scaled' result's knownGaps would — captured unconditionally per this
    // function's own comment ("Present on both union members").
    expect(result.knownGaps).toContain('mocked FD-3 signal for coverage');
  });
});
