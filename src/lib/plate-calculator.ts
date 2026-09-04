// Standard Olympic bar (kg) and the plate sizes actually found on a
// kg-loaded rack, largest first — matches this app's own weight input,
// which is always kg (see check-in.tsx's "Weight used (optional)" field).
const BARBELL_KG = 20;
const AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// A real physical constraint, not an arbitrary weight ceiling: a standard
// Olympic bar's loadable sleeve is roughly 415mm, which fits about this many
// 45-50mm-thick plates before you'd need collars sized for a longer sleeve
// or a different bar entirely. Tying the cap to bar capacity (not a round
// weight number like "500kg") means it's still correct for whatever
// combination of plate sizes actually gets used, and it caps the OUTPUT
// (a bounded, realistic-looking breakdown) rather than rejecting the input —
// someone logging a genuinely heavy machine lift (weight stacks routinely
// exceed any barbell's real capacity) still gets their weight recorded for
// progressive-overload tracking; this only bounds what the plate breakdown
// itself claims to show.
const MAX_PLATES_PER_SIDE = 8;

export type PlateBreakdown = {
  /** Plates for ONE side of the bar, largest first — double this (plus the
   * bar) to get the total loaded weight. */
  platesPerSide: number[];
  /** The actual loaded weight this breakdown produces — may differ from the
   * requested target when it can't be hit exactly with real plate
   * increments (rounded down, never up, so this never overstates the load
   * someone's about to lift), or when the target exceeds what a standard
   * bar can realistically hold (see exceedsBarCapacity). */
  actualWeightKg: number;
  /** True when MAX_PLATES_PER_SIDE was hit before actually reaching the
   * target — the breakdown is real and loadable, just not the full amount
   * asked for, since nothing past this is a realistic single-bar setup. */
  exceedsBarCapacity: boolean;
};

/**
 * Greedy largest-plate-first breakdown — the same way anyone actually loads
 * a bar in a gym, not an optimization search for some other property. A
 * target below the bar's own weight has nothing to load (empty bar is the
 * honest answer, not an error).
 */
export function calculatePlates(targetWeightKg: number, barbellKg: number = BARBELL_KG): PlateBreakdown {
  if (targetWeightKg <= barbellKg) {
    return { platesPerSide: [], actualWeightKg: barbellKg, exceedsBarCapacity: false };
  }
  let perSideRemaining = (targetWeightKg - barbellKg) / 2;
  const platesPerSide: number[] = [];
  // Distinct from the pre-existing granularity round-down below (e.g. a
  // 21kg target rounds to a 20kg empty bar since 0.5kg/side isn't a real
  // plate size) — that's "not exactly hittable," this is "hit the cap
  // before even trying the smaller plates that would close the gap."
  let hitCapacityCap = false;
  for (const plate of AVAILABLE_PLATES_KG) {
    while (perSideRemaining >= plate) {
      if (platesPerSide.length >= MAX_PLATES_PER_SIDE) {
        hitCapacityCap = true;
        break;
      }
      platesPerSide.push(plate);
      perSideRemaining -= plate;
    }
    if (hitCapacityCap) break;
  }
  const actualWeightKg = barbellKg + platesPerSide.reduce((sum, p) => sum + p, 0) * 2;
  return { platesPerSide, actualWeightKg, exceedsBarCapacity: hitCapacityCap };
}

/** Shared by formatPlateBreakdown below and check-in.tsx's own "Last time"
 * hint — one place deciding "52.5" reads better than "52.50" or "52.5000000000001". */
export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** "25 + 5 + 2.5 per side" / "Empty bar" — the one-line summary check-in.tsx
 * actually renders. Separate from calculatePlates itself so the pure
 * breakdown stays trivially testable without string formatting noise. */
export function formatPlateBreakdown(breakdown: PlateBreakdown): string {
  if (breakdown.platesPerSide.length === 0) return 'Empty bar';
  const base = breakdown.platesPerSide.map(formatKg).join(' + ') + ' per side';
  return breakdown.exceedsBarCapacity ? `${base} (max a standard bar holds — ${formatKg(breakdown.actualWeightKg)}kg loaded)` : base;
}
