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

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** "tuesday,friday,sunday" → "Tue, Fri, Sun" — calendar order, not selection order. */
export function formatDays(days: string | undefined): string {
  if (!days) return 'Not set';
  const selected = new Set(days.split(',').filter(Boolean));
  const ordered = DAY_ORDER.filter((d) => selected.has(d));
  return ordered.map((d) => DAY_ABBREVIATIONS[d]).join(', ') || 'Not set';
}
