import type { BodyArea } from '@/lib/plan-preview';

/**
 * Shared human-facing labels for the engine's 4 body areas — used anywhere a
 * real BodyArea value needs a display string (Progress's own Training
 * Balance list/radar, the retroactive past-session logger, check-in.tsx's
 * own rest-day body-area preference). One
 * definition instead of several drifting copies.
 */
export const BODY_AREA_LABELS: Record<BodyArea, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  core: 'Core',
  full: 'Full Body',
};

export const BODY_AREA_ORDER: BodyArea[] = ['upper', 'lower', 'core', 'full'];
