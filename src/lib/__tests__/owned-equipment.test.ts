import requirementData from '@/lib/engine/data/exercise-equipment.json';
import { equipmentRequirementsFor, hasEquipmentFor } from '@/lib/engine/equipment-requirements';
import { exerciseLibrary } from '@/lib/engine/exercise-library';
import { DEFAULT_CALIBRATION } from '@/lib/engine/personal-calibration';
import { LOCAL_USER_ID } from '@/lib/onboarding-to-engine';
import {
  describeOwnedEquipment,
  OWNED_EQUIPMENT,
  ownedEquipmentFor,
  parseOwnedEquipment,
  serializeOwnedEquipment,
  type OwnedEquipment,
} from '@/lib/owned-equipment';
import { computePlanPreview, type EnergyLevel } from '@/lib/plan-preview';
import { TIME_AVAILABLE_OPTIONS } from '@/lib/time-available';
import type { UserProfile } from '@/lib/user-profile';

const CALIBRATION = { userId: LOCAL_USER_ID, ...DEFAULT_CALIBRATION };
const REQUIREMENTS = requirementData as Record<string, string[][]>;
const KNOWN_ITEMS = new Set<string>([...OWNED_EQUIPMENT, 'gym']);

const BASE: Partial<UserProfile> = {
  goal: 'get-stronger',
  experience: 'years-experience',
  days: 'monday,tuesday,wednesday,thursday,friday,saturday,sunday',
};

function plansFor(profile: Partial<UserProfile>, equipmentOverride?: string) {
  const plans = [];
  for (const energy of [2, 3, 4, 5] as EnergyLevel[]) {
    for (const timeAvailableMin of [undefined, ...TIME_AVAILABLE_OPTIONS]) {
      plans.push(
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
          false,
          undefined,
          undefined,
          equipmentOverride
        )
      );
    }
  }
  return plans;
}

describe('exercise equipment data', () => {
  it('covers every exercise the library says needs equipment', () => {
    const untagged = exerciseLibrary
      .all()
      .filter((ex) => ex.equipment !== 'none' && equipmentRequirementsFor(ex.id) === undefined)
      .map((ex) => ex.name);
    expect(untagged).toEqual([]);
  });

  it('only names real exercises and known items', () => {
    for (const [id, alternatives] of Object.entries(REQUIREMENTS)) {
      expect(exerciseLibrary.getById(id)).toBeDefined();
      for (const items of alternatives) {
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) expect(KNOWN_ITEMS.has(item)).toBe(true);
      }
    }
  });

  it('treats an exercise the tagging never saw by its library tier', () => {
    const bodyweight = exerciseLibrary.all().find((ex) => ex.equipment === 'none' && !REQUIREMENTS[ex.id])!;
    const equipped = { ...exerciseLibrary.all().find((ex) => ex.equipment === 'full_gym')!, id: 'ex_untagged' };
    expect(hasEquipmentFor(bodyweight, [])).toBe(true);
    expect(hasEquipmentFor(equipped, [...OWNED_EQUIPMENT])).toBe(false);
    expect(hasEquipmentFor(equipped, null)).toBe(true);
  });

  it('accepts any one of an exercise’s alternatives, and all of what one needs', () => {
    const goblet = exerciseLibrary.all().find((ex) => ex.name === 'Goblet Lunge')!;
    expect(hasEquipmentFor(goblet, ['kettlebell'])).toBe(true);
    expect(hasEquipmentFor(goblet, ['dumbbell'])).toBe(true);
    expect(hasEquipmentFor(goblet, ['band'])).toBe(false);
    const incline = exerciseLibrary.all().find((ex) => ex.name === 'Incline Dumbbell Press')!;
    expect(hasEquipmentFor(incline, ['dumbbell'])).toBe(false);
    expect(hasEquipmentFor(incline, ['dumbbell', 'bench'])).toBe(true);
  });
});

describe('owned equipment answers', () => {
  it('round-trips a list in a fixed order, and an empty answer as none', () => {
    expect(serializeOwnedEquipment(['bench', 'dumbbell'])).toBe('dumbbell,bench');
    expect(parseOwnedEquipment('bench,dumbbell,not-a-thing')).toEqual(['dumbbell', 'bench']);
    expect(serializeOwnedEquipment([])).toBe('none');
    expect(parseOwnedEquipment('none')).toEqual([]);
    expect(parseOwnedEquipment(undefined)).toBeUndefined();
    expect(parseOwnedEquipment('')).toBeUndefined();
  });

  it('names the kit the way a sentence reads it', () => {
    expect(describeOwnedEquipment(['band'])).toBe('bands');
    expect(describeOwnedEquipment(['band', 'dumbbell', 'bench'])).toBe('dumbbells, bench and bands');
    expect(describeOwnedEquipment(['dumbbell', 'bench', 'band', 'pullup_bar', 'box'])).toBe('dumbbells, bench, pull-up bar and 2 more');
    const note = computePlanPreview({ ...BASE, environment: 'home-gym', equipment: 'dumbbell,band' } as UserProfile, 4, CALIBRATION).equipmentNote;
    expect(note).toBe('Built around your dumbbells and bands.');
  });

  it('maps each setup to what the engine may assume', () => {
    expect(ownedEquipmentFor('full-gym', 'dumbbell')).toBeNull();
    expect(ownedEquipmentFor('bodyweight-only', 'dumbbell,barbell')).toEqual([]);
    expect(ownedEquipmentFor('home-gym', 'kettlebell')).toEqual(['kettlebell']);
    expect(ownedEquipmentFor('home-gym', undefined)).toEqual(['dumbbell', 'bench', 'band', 'pullup_bar']);
    expect(ownedEquipmentFor('minimal-equipment', 'none')).toEqual([]);
    expect(ownedEquipmentFor(undefined, undefined)).toBeNull();
  });
});

describe('computePlanPreview — owned equipment', () => {
  const cases: { label: string; profile: Partial<UserProfile>; owned: readonly OwnedEquipment[] }[] = [
    { label: 'bodyweight only', profile: { ...BASE, environment: 'bodyweight-only' }, owned: [] },
    { label: 'dumbbells only', profile: { ...BASE, environment: 'home-gym', equipment: 'dumbbell' }, owned: ['dumbbell'] },
    { label: 'bands only', profile: { ...BASE, environment: 'minimal-equipment', equipment: 'band' }, owned: ['band'] },
    { label: 'answered none', profile: { ...BASE, environment: 'home-gym', equipment: 'none' }, owned: [] },
    {
      label: 'a full home setup',
      profile: { ...BASE, environment: 'home-gym', equipment: serializeOwnedEquipment(OWNED_EQUIPMENT) },
      owned: OWNED_EQUIPMENT,
    },
  ];

  it.each(cases)('only ever plans what $label can do, at every energy and time', ({ profile, owned }) => {
    for (const plan of plansFor(profile)) {
      for (const ex of plan.exercises) {
        expect(hasEquipmentFor(exerciseLibrary.getById(ex.id)!, owned)).toBe(true);
      }
    }
  });

  it('lets a home barbell count, though the library files barbell work under full gym', () => {
    const withBarbell = plansFor({ ...BASE, environment: 'home-gym', equipment: 'barbell,bench' });
    const needsBarbell = withBarbell.flatMap((p) => p.exercises).some((ex) =>
      equipmentRequirementsFor(ex.id)?.every((items) => items.includes('barbell'))
    );
    expect(needsBarbell).toBe(true);
  });

  it('never hands bodyweight-only a pull-up, which the library files as bodyweight', () => {
    const names = plansFor({ ...BASE, environment: 'bodyweight-only' }).flatMap((p) => p.exercises.map((ex) => ex.name));
    expect(names.some((name) => /pull-?up|chin-?up/i.test(name))).toBe(false);
  });

  it("follows the day's setup: a full-gym member training at home with nothing", () => {
    for (const plan of plansFor({ ...BASE, environment: 'full-gym' }, 'bodyweight-only')) {
      for (const ex of plan.exercises) expect(hasEquipmentFor(exerciseLibrary.getById(ex.id)!, [])).toBe(true);
    }
  });

  it('keeps a home or minimal day to their own kit, and uses the defaults only without a list', () => {
    for (const day of ['home-gym', 'minimal-equipment']) {
      for (const plan of plansFor({ ...BASE, environment: 'home-gym', equipment: 'kettlebell' }, day)) {
        for (const ex of plan.exercises) expect(hasEquipmentFor(exerciseLibrary.getById(ex.id)!, ['kettlebell'])).toBe(true);
      }
    }
    for (const plan of plansFor({ ...BASE, environment: 'full-gym' }, 'minimal-equipment')) {
      for (const ex of plan.exercises) {
        expect(hasEquipmentFor(exerciseLibrary.getById(ex.id)!, ['dumbbell', 'band'])).toBe(true);
      }
    }
  });

  it('leaves a full gym exactly as it was', () => {
    const withList = plansFor({ ...BASE, environment: 'full-gym', equipment: 'band' });
    const without = plansFor({ ...BASE, environment: 'full-gym' });
    expect(withList.map((p) => p.exercises.map((ex) => ex.id))).toEqual(without.map((p) => p.exercises.map((ex) => ex.id)));
  });
});
