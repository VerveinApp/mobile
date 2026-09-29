import { equipmentRequirementsFor } from '@/lib/engine/equipment-requirements';
import { exerciseLibrary } from '@/lib/engine/exercise-library';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import { computePlanPreview, type EnergyLevel } from '@/lib/plan-preview';
import type { UserProfile } from '@/lib/user-profile';

const CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };
const EVERY_DAY = 'monday,tuesday,wednesday,thursday,friday,saturday,sunday';

function plan(profile: Partial<UserProfile>, energy: EnergyLevel, timeAvailableMin?: number) {
  return computePlanPreview(
    { goal: 'get-stronger', days: EVERY_DAY, ...profile } as UserProfile,
    energy,
    CALIBRATION,
    [],
    undefined,
    1,
    undefined,
    timeAvailableMin
  );
}

const areaOf = (id: string) => exerciseLibrary.getById(id)!.body_area;
const patternOf = (id: string) => exerciseLibrary.getById(id)!.movement_patterns[0];

// Which exercises a plan leads with — see bySelectionOrder's training-value
// note and baseline-plan.ts's varied-before-repeated pass.
describe('plan exercise selection', () => {
  it('builds a good day around compound moves that use the kit owned', () => {
    const p = plan({ experience: 'years-experience', environment: 'home-gym', equipment: 'dumbbell' }, 4);
    const upper = p.exercises.filter((ex) => areaOf(ex.id) === 'upper');
    expect(upper.length).toBeGreaterThanOrEqual(2);
    for (const ex of upper) {
      expect(exerciseLibrary.getById(ex.id)!.is_compound).toBe('compound');
      expect(equipmentRequirementsFor(ex.id)?.length).toBeGreaterThan(0);
    }
  });

  it('varies the movement pattern within a body area', () => {
    for (const equipment of ['dumbbell', 'kettlebell', 'dumbbell,bench,band,pullup_bar']) {
      const p = plan({ experience: 'years-experience', environment: 'home-gym', equipment }, 4);
      for (const area of ['upper', 'lower']) {
        const patterns = p.exercises.filter((ex) => areaOf(ex.id) === area).map((ex) => patternOf(ex.id)).filter(Boolean);
        expect(new Set(patterns).size).toBe(patterns.length);
      }
    }
  });

  it('puts a pull-up bar to use when it is the kit there is', () => {
    const p = plan({ experience: 'years-experience', environment: 'home-gym', equipment: 'pullup_bar' }, 4);
    expect(p.exercises.some((ex) => equipmentRequirementsFor(ex.id)?.some((alt) => alt.includes('pullup_bar')))).toBe(true);
  });

  it('refills a low-energy day area by area, so it keeps upper-body work', () => {
    for (const environment of ['full-gym', 'bodyweight-only']) {
      const p = plan({ experience: 'years-experience', environment }, 2);
      expect(p.exercises.some((ex) => areaOf(ex.id) === 'upper')).toBe(true);
      const lowerPatterns = p.exercises.filter((ex) => areaOf(ex.id) === 'lower').map((ex) => patternOf(ex.id)).filter(Boolean);
      expect(new Set(lowerPatterns).size).toBe(lowerPatterns.length);
    }
  });

  it('keeps a plan inside the session length chosen at onboarding, without calling it shortened', () => {
    for (const [duration, ceiling] of [['under-30', 30], ['30-45', 45], ['45-60', 60]] as const) {
      const p = plan({ experience: 'years-experience', environment: 'full-gym', duration }, 4);
      if (p.exerciseCount > 2) expect(p.durationMin).toBeLessThanOrEqual(ceiling);
      expect(p.explanation).not.toContain('Shortened');
    }
  });

  it("lets today's own time pick override the standing session length, and says so", () => {
    const p = plan({ experience: 'years-experience', environment: 'full-gym', duration: '60-plus' }, 4, 15);
    expect(p.explanation).toContain('Shortened for the 15 minutes you have today.');
  });
});
