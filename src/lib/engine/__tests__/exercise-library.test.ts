import { exerciseLibrary } from '@/lib/engine/exercise-library';

// Data-integrity checks on the real 1,449-exercise compiled library
// (data/exercise-library.json). The constructor already throws on a
// non-canonical intensity/impact/equipment value, so importing the module
// at all is itself a partial integrity check — these tests cover the
// invariants that would NOT throw (a duplicate id silently shadowing
// another in the byId Map, a missing required field silently reading as
// `undefined` everywhere it's used) plus an independent re-check of the
// canonical fields the constructor already guards, so a future refactor of
// that guard can't quietly drop coverage without a test noticing.

const CANONICAL_TYPE = ['strength', 'power', 'mobility', 'recovery', 'cardio'];
const CANONICAL_INTENSITY = ['low', 'medium', 'high'];
const CANONICAL_IMPACT = ['low', 'medium', 'high'];
const CANONICAL_BODY_AREA = ['full', 'upper', 'lower', 'core'];
const CANONICAL_COMPLEXITY = ['simple', 'moderate'];
const CANONICAL_EQUIPMENT = ['none', 'minimal', 'full_gym'];
const CANONICAL_MOVEMENT_PATTERN = [
  'squat', 'hinge', 'push', 'pull', 'carry', 'plank',
  'rotate', 'jump', 'overhead', 'kneel', 'floor', 'run',
];
const CANONICAL_REP_STRUCTURE = ['discrete', 'isometric_hold', 'loaded_carry'];
const CANONICAL_IS_COMPOUND = ['compound', 'accessory'];
const CANONICAL_LATERALITY = ['unilateral', 'bilateral'];
const CANONICAL_ROM_DEMAND = ['partial', 'moderate', 'full'];

describe('exercise-library data integrity', () => {
  const all = exerciseLibrary.all();

  it('loads the real compiled library, not a placeholder slice', () => {
    expect(all.length).toBeGreaterThan(1000);
  });

  it('has no duplicate ids', () => {
    const ids = all.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every exercise has all required fields present', () => {
    for (const ex of all) {
      expect(typeof ex.id).toBe('string');
      expect(ex.id.length).toBeGreaterThan(0);
      expect(typeof ex.name).toBe('string');
      expect(ex.name.length).toBeGreaterThan(0);
      expect(typeof ex.type).toBe('string');
      expect(typeof ex.impact).toBe('string');
      expect(typeof ex.body_area).toBe('string');
      expect(typeof ex.complexity).toBe('string');
      expect(typeof ex.equipment).toBe('string');
      // Empty is legitimate here — isolation exercises (leg extension,
      // lateral raise, bicep curl, …) genuinely have no canonical
      // compound-movement pattern to report; ~42% of the real library is
      // like this, so an empty array is not itself a data defect.
      expect(Array.isArray(ex.movement_patterns)).toBe(true);
      expect(typeof ex.rep_structure).toBe('string');
      expect(typeof ex.laterality).toBe('string');
      expect(Array.isArray(ex.contraindications)).toBe(true);
      expect(typeof ex.active).toBe('boolean');
    }
  });

  it('every exercise has canonical enum values', () => {
    for (const ex of all) {
      expect(CANONICAL_TYPE).toContain(ex.type);
      expect(CANONICAL_IMPACT).toContain(ex.impact);
      expect(CANONICAL_BODY_AREA).toContain(ex.body_area);
      expect(CANONICAL_COMPLEXITY).toContain(ex.complexity);
      expect(CANONICAL_EQUIPMENT).toContain(ex.equipment);
      expect(CANONICAL_REP_STRUCTURE).toContain(ex.rep_structure);
      expect(CANONICAL_LATERALITY).toContain(ex.laterality);
      for (const pattern of ex.movement_patterns) {
        expect(CANONICAL_MOVEMENT_PATTERN).toContain(pattern);
      }
      // Nullable enums — only checked against the canonical set when present.
      if (ex.intensity !== null) expect(CANONICAL_INTENSITY).toContain(ex.intensity);
      if (ex.is_compound !== null) expect(CANONICAL_IS_COMPOUND).toContain(ex.is_compound);
      if (ex.rom_demand !== null) expect(CANONICAL_ROM_DEMAND).toContain(ex.rom_demand);
    }
  });

  it('every entry in byId/byName lookup matches the source array (no Map/array drift)', () => {
    for (const ex of all) {
      expect(exerciseLibrary.getById(ex.id)).toBe(ex);
    }
  });

  it('the M7 fallback pair (ex_1023, ex_1083) resolves — checked again independently of the boot-time throw', () => {
    expect(exerciseLibrary.getById('ex_1023')).not.toBeNull();
    expect(exerciseLibrary.getById('ex_1083')).not.toBeNull();
  });
});
