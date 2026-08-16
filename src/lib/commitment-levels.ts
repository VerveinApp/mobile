/**
 * Index is 0-based (matches CommitmentDial's stop index); the persisted
 * `commitmentLevel` is this index + 1, i.e. 1–8. Not called "consistency"
 * anywhere user-facing — this is capacity/commitment, and it directly
 * scales how demanding the generated plan is, not a judgment of the user.
 *
 * Shared between step-7.tsx (where it's set) and the trajectory screen
 * (where it's summarized back) so the name/quote for a given level can't
 * drift between the two.
 */
export const COMMITMENT_LEVELS: { name: string; quote?: string }[] = [
  { name: 'Bare minimum', quote: 'Keep me moving, even on rough weeks.' },
  { name: 'Light' },
  { name: 'Steady' },
  { name: 'Moderate' },
  { name: 'Committed' },
  { name: 'Serious', quote: 'I can make training a real priority.' },
  { name: 'High commitment' },
  { name: 'All in', quote: 'I’m ready to prioritize training.' },
];
