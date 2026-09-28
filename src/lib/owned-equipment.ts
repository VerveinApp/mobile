/**
 * The equipment someone can tick as "what I have" — the home-kit
 * vocabulary of engine/equipment-requirements.ts, minus 'gym' (never
 * ownable; only a full gym covers it). Asked only for a home gym or minimal
 * setup: a full gym has everything and bodyweight-only has nothing, so
 * those two need no list.
 */
export const OWNED_EQUIPMENT = [
  'dumbbell',
  'kettlebell',
  'barbell',
  'bench',
  'pullup_bar',
  'band',
  'suspension',
  'medball',
  'stability_ball',
  'box',
  'cable',
  'dip_bars',
  'weight_vest',
  'ankle_weights',
  'cardio',
  'foam_roller',
] as const;

export type OwnedEquipment = (typeof OWNED_EQUIPMENT)[number];

export const OWNED_EQUIPMENT_LABELS: Record<OwnedEquipment, string> = {
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebells',
  barbell: 'Barbell & plates',
  bench: 'Bench',
  pullup_bar: 'Pull-up bar',
  band: 'Resistance bands',
  suspension: 'Suspension trainer or rings',
  medball: 'Medicine ball',
  stability_ball: 'Stability ball',
  box: 'Plyo box',
  cable: 'Cable machine',
  dip_bars: 'Dip bars or parallettes',
  weight_vest: 'Weight vest',
  ankle_weights: 'Ankle weights',
  cardio: 'Cardio machine or jump rope',
  foam_roller: 'Foam roller',
};

/** Pre-ticked when the list is first shown, and what the engine assumes for
 * anyone who picked one of these setups but never answered the list (every
 * profile from before it existed). Deliberately modest: an item assumed but
 * not owned hands someone a move they can't do; one owned but not assumed
 * only means less variety until they add it. */
export const DEFAULT_OWNED_EQUIPMENT: Record<'home-gym' | 'minimal-equipment', readonly OwnedEquipment[]> = {
  'home-gym': ['dumbbell', 'bench', 'band', 'pullup_bar'],
  'minimal-equipment': ['dumbbell', 'band'],
};

export function asksForEquipment(environment: string | undefined): environment is 'home-gym' | 'minimal-equipment' {
  return environment === 'home-gym' || environment === 'minimal-equipment';
}

export function isOwnedEquipment(value: string): value is OwnedEquipment {
  return (OWNED_EQUIPMENT as readonly string[]).includes(value);
}

/** Stored like `days` — comma-separated, so it rides onboarding's route
 * params unchanged. `undefined` (or '') = never answered; 'none' = answered,
 * and none of these. */
export function parseOwnedEquipment(raw: string | undefined): OwnedEquipment[] | undefined {
  if (!raw) return undefined;
  return OWNED_EQUIPMENT.filter((item) => raw.split(',').map((s) => s.trim()).includes(item));
}

/** In the list's own order, so the same answer always saves as the same
 * string; 'none' when nothing is ticked, so it can't read as unanswered. */
export function serializeOwnedEquipment(items: Iterable<OwnedEquipment>): string {
  const set = new Set(items);
  const ticked = OWNED_EQUIPMENT.filter((item) => set.has(item));
  return ticked.length > 0 ? ticked.join(',') : 'none';
}

/**
 * What the engine may assume is on hand. null = no item-level limit (a full
 * gym, or an environment this doesn't recognise, which keeps the old
 * tier-only behavior); [] = nothing (bodyweight only).
 */
export function ownedEquipmentFor(environment: string | undefined, saved: string | undefined): readonly string[] | null {
  if (environment === 'bodyweight-only') return [];
  if (asksForEquipment(environment)) return parseOwnedEquipment(saved) ?? DEFAULT_OWNED_EQUIPMENT[environment];
  return null;
}
