/**
 * Short, profile-row-friendly labels for the raw onboarding answer ids —
 * distinct from each onboarding screen's own longer, persuasive copy
 * ("I'm just getting started"), which reads fine as a question option but
 * not as a compact summary row.
 */

export const GOAL_LABELS: Record<string, string> = {
  'build-physique': 'Build Physique',
  'get-leaner': 'Get Leaner',
  'get-stronger': 'Get Stronger',
  'move-better': 'Move Better',
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  'just-starting': 'Just Starting',
  'trained-before': 'Trained Before',
  'train-regularly': 'Train Regularly',
  'years-experience': 'Years of Experience',
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
  'full-gym': 'Full Gym',
  'home-gym': 'Home Gym',
  'minimal-equipment': 'Minimal Equipment',
  'bodyweight-only': 'Bodyweight Only',
};

// Same order onboarding/step-4.tsx displays these in — shared so any other
// screen iterating this list (check-in.tsx's own "Where are you working out
// today?") matches the exact order someone already saw once at onboarding.
export const ENVIRONMENT_ORDER = ['full-gym', 'home-gym', 'minimal-equipment', 'bodyweight-only'] as const;

// Home and Train both derive today's session name from the same onboarding
// goal — one definition instead of two copies that could silently drift
// (e.g. Home renaming a session type without Train picking up the change).
export const SESSION_LABEL_BY_GOAL: Record<string, string> = {
  'build-physique': 'Strength Session',
  'get-leaner': 'Conditioning Session',
  'get-stronger': 'Strength Session',
  'move-better': 'Mobility Session',
};

export const DURATION_LABELS: Record<string, string> = {
  'under-30': 'Under 30 min',
  '30-45': '30–45 min',
  '45-60': '45–60 min',
  '60-plus': '60+ min',
};

const DAY_ABBREVIATIONS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** Calendar order (Monday-first), the convention used everywhere days are listed — the onboarding day picker, the adjust-plan sheet, and this formatter. */
export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Sunday-indexed, matching `Date.prototype.getDay()` exactly (0 = Sunday)
 * — every `WEEKDAY_NAMES[someDate.getDay()]` lookup across the app used to
 * hardcode this same literal independently (a later full-app audit found 8
 * separate copies); one shared export instead, same "don't hardcode the
 * same invariant independently in N files" fix as ROLLING_WINDOW_DAYS.
 * Not interchangeable with DAY_ORDER above — that one is calendar display
 * order (Monday-first), this one is JS's own Date indexing order. */
export const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** "tuesday,friday,sunday" → "Tue, Fri, Sun" — calendar order, not selection order. */
export function formatDays(days: string | undefined): string {
  if (!days) return 'Not set';
  const selected = new Set(days.split(',').filter(Boolean));
  const ordered = DAY_ORDER.filter((d) => selected.has(d));
  return ordered.map((d) => DAY_ABBREVIATIONS[d]).join(', ') || 'Not set';
}
