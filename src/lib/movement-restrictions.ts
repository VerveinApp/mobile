/**
 * The vault's real Movement Restrictions Screen (Onboarding Screen 9) —
 * "the lowest-risk health-adjacent screen in the entire flow... requires
 * zero diagnostic inference." Unlike lib/conditions.ts, this one IS wired
 * into the engine: constraint-resolution.ts already validates and applies
 * `movementRestrictions` against exactly this vocabulary, and
 * onboarding-to-engine.ts previously hardcoded it to `[]` only because
 * nothing collected it — the module itself was always ready. Self-reported
 * capability ("my body doesn't do this") needs no clinical validation the
 * way a diagnosed condition's exercise-exclusion priors would.
 */
export const MOVEMENT_RESTRICTIONS = ['jump', 'kneel', 'overhead', 'floor', 'run'] as const;

export type MovementRestriction = (typeof MOVEMENT_RESTRICTIONS)[number];

export const MOVEMENT_RESTRICTION_LABELS: Record<MovementRestriction, string> = {
  jump: 'Jumping',
  kneel: 'Kneeling',
  overhead: 'Overhead reaching or pressing',
  floor: 'Getting down to the floor',
  run: 'Running',
};
