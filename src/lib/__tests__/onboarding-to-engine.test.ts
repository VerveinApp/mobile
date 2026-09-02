import { LOCAL_USER_ID, profileToOnboardingContext } from '@/lib/onboarding-to-engine';
import type { UserProfile } from '@/lib/user-profile';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    experience: 'trained-before',
    environment: 'home-gym',
    duration: '30-45',
    commitmentLevel: '4',
    days: 'monday,wednesday,friday',
    ...overrides,
  };
}

describe('profileToOnboardingContext', () => {
  it('maps experience to targetIntensity and the simple-exercise bias consistently', () => {
    expect(profileToOnboardingContext(makeProfile({ experience: 'just-starting' }))).toMatchObject({
      targetIntensity: 'low',
      biasSimpleExercises: true,
    });
    expect(profileToOnboardingContext(makeProfile({ experience: 'years-experience' }))).toMatchObject({
      targetIntensity: 'high',
      biasSimpleExercises: false,
    });
  });

  it('defaults to medium intensity and no simple-exercise bias for an unrecognized/missing experience value', () => {
    const result = profileToOnboardingContext(makeProfile({ experience: undefined }));
    expect(result.targetIntensity).toBe('medium');
    expect(result.biasSimpleExercises).toBe(false);
  });

  it('maps environment to the engine\'s equipment tiers, with home-gym landing on the middle tier', () => {
    expect(profileToOnboardingContext(makeProfile({ environment: 'full-gym' })).equipment).toBe('full_gym');
    expect(profileToOnboardingContext(makeProfile({ environment: 'home-gym' })).equipment).toBe('minimal');
    expect(profileToOnboardingContext(makeProfile({ environment: 'minimal-equipment' })).equipment).toBe('minimal');
    expect(profileToOnboardingContext(makeProfile({ environment: 'bodyweight-only' })).equipment).toBe('none');
  });

  it('defaults to minimal equipment for an unrecognized/missing environment value', () => {
    expect(profileToOnboardingContext(makeProfile({ environment: undefined })).equipment).toBe('minimal');
  });

  it('always sets focusAreas to ["full"] — this app never asks which body area to prioritize', () => {
    expect(profileToOnboardingContext(makeProfile()).focusAreas).toEqual(['full']);
  });

  it('always sets conditions and standingSymptomTags to [] — those intake modules are not ported', () => {
    const result = profileToOnboardingContext(makeProfile());
    expect(result.conditions).toEqual([]);
    expect(result.standingSymptomTags).toEqual([]);
  });

  it('passes movementRestrictions straight through, defaulting to [] when never answered', () => {
    expect(profileToOnboardingContext(makeProfile({ movementRestrictions: ['jump'] })).movementRestrictions).toEqual(['jump']);
    expect(profileToOnboardingContext(makeProfile({ movementRestrictions: undefined })).movementRestrictions).toEqual([]);
  });

  it('parses the comma-separated day-name string into SessionDay codes, dropping unrecognized entries', () => {
    const result = profileToOnboardingContext(makeProfile({ days: 'monday, wednesday,not-a-day' }));
    expect(result.sessionDays).toEqual(['mon', 'wed']);
  });

  it('produces an empty sessionDays list when days is missing entirely, never throwing', () => {
    expect(profileToOnboardingContext(makeProfile({ days: undefined })).sessionDays).toEqual([]);
  });

  it('commitmentLevel maps to progressionSpeed/volumeStance in thirds, defaulting to 4 ("moderate"/"standard") when unparseable', () => {
    expect(profileToOnboardingContext(makeProfile({ commitmentLevel: '2' })).conditionProfile).toMatchObject({
      progressionSpeed: 'slow',
      volumeStance: 'conservative',
    });
    expect(profileToOnboardingContext(makeProfile({ commitmentLevel: '4' })).conditionProfile).toMatchObject({
      progressionSpeed: 'moderate',
      volumeStance: 'standard',
    });
    expect(profileToOnboardingContext(makeProfile({ commitmentLevel: '7' })).conditionProfile).toMatchObject({
      progressionSpeed: 'fast',
      volumeStance: 'standard',
    });
    expect(profileToOnboardingContext(makeProfile({ commitmentLevel: 'not-a-number' })).conditionProfile).toMatchObject({
      progressionSpeed: 'moderate',
      volumeStance: 'standard',
    });
  });

  it('maps duration to preferredSessionMin using the same buckets plan-preview.ts uses, defaulting to 38', () => {
    expect(profileToOnboardingContext(makeProfile({ duration: 'under-30' })).conditionProfile.preferredSessionMin).toBe(25);
    expect(profileToOnboardingContext(makeProfile({ duration: '60-plus' })).conditionProfile.preferredSessionMin).toBe(65);
    expect(profileToOnboardingContext(makeProfile({ duration: undefined })).conditionProfile.preferredSessionMin).toBe(38);
  });

  it('conditionProfile.impactCeiling always defaults to the most permissive ("high") — no injury data is collected yet', () => {
    expect(profileToOnboardingContext(makeProfile()).conditionProfile.impactCeiling).toBe('high');
  });

  it('LOCAL_USER_ID is a fixed, stable label for this local-only, single-profile app', () => {
    expect(LOCAL_USER_ID).toBe('local-user');
  });
});
