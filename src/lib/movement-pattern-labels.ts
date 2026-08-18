import type { MovementPattern } from '@/lib/engine/types';

/**
 * Neutral, short display labels for the engine's real 12 movement patterns
 * — distinct from movement-restrictions.ts's labels (those five overlap by
 * name but are phrased as restrictions, e.g. "Getting down to the floor",
 * which reads wrong for an observational breakdown of what someone actually
 * did).
 */
export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  push: 'Push',
  pull: 'Pull',
  carry: 'Carry',
  plank: 'Plank',
  rotate: 'Rotation',
  jump: 'Jump',
  overhead: 'Overhead',
  kneel: 'Kneeling',
  floor: 'Floor Work',
  run: 'Running',
};
