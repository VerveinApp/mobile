// Standard Olympic bar (kg) and the plate sizes actually found on a
// kg-loaded rack, largest first — matches this app's own weight input,
// which is always kg (see check-in.tsx's "Weight used (optional)" field).
const BARBELL_KG = 20;
const AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export type PlateBreakdown = {
  /** Plates for ONE side of the bar, largest first — double this (plus the
   * bar) to get the total loaded weight. */
  platesPerSide: number[];
  /** The actual loaded weight this breakdown produces — may differ from the
   * requested target when it can't be hit exactly with real plate
   * increments (rounded down, never up, so this never overstates the load
   * someone's about to lift). */
  actualWeightKg: number;
};

/**
 * Greedy largest-plate-first breakdown — the same way anyone actually loads
 * a bar in a gym, not an optimization search for some other property. A
 * target below the bar's own weight has nothing to load (empty bar is the
 * honest answer, not an error).
 */
export function calculatePlates(targetWeightKg: number, barbellKg: number = BARBELL_KG): PlateBreakdown {
  if (targetWeightKg <= barbellKg) {
    return { platesPerSide: [], actualWeightKg: barbellKg };
  }
  let perSideRemaining = (targetWeightKg - barbellKg) / 2;
  const platesPerSide: number[] = [];
  for (const plate of AVAILABLE_PLATES_KG) {
    while (perSideRemaining >= plate) {
      platesPerSide.push(plate);
      perSideRemaining -= plate;
    }
  }
  const actualWeightKg = barbellKg + platesPerSide.reduce((sum, p) => sum + p, 0) * 2;
  return { platesPerSide, actualWeightKg };
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
  return breakdown.platesPerSide.map(formatKg).join(' + ') + ' per side';
}
