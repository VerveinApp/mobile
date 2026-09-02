/**
 * The discrete options offered at check-in for "how much time do you have
 * today?" — a second, independent input alongside energy (see
 * plan-preview.ts's timeAvailableMin param). 60 stands in for "60+"; the
 * engine takes it as a real ceiling like any other value, not a special
 * case — someone with an hour-plus is, for planning purposes, unconstrained
 * relative to what energy alone would produce for this app's session
 * lengths, so no separate "no ceiling" branch is needed for it.
 */
export const TIME_AVAILABLE_OPTIONS = [15, 30, 45, 60] as const;

export type TimeAvailableMin = (typeof TIME_AVAILABLE_OPTIONS)[number];

export const TIME_AVAILABLE_LABELS: Record<TimeAvailableMin, string> = {
  15: '15 min',
  30: '30 min',
  45: '45 min',
  60: '60+ min',
};
