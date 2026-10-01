import { router } from 'expo-router';

import type { SymbolView } from '@/components/ui/app-symbol';

/**
 * Every real VerveIn Plus gate in the app, grouped the way the paywall
 * lists them — the one source for both the paywall's feature list and the
 * `feature` every locked entry point passes when it opens the paywall, so
 * the row for whatever someone just tapped can lead the list.
 *
 * Where each one is enforced (grep PremiumGate / isPremium before trusting
 * this is still complete):
 * - strength: Progress' Strength Progress; PR celebrations after a session (check-in.tsx)
 * - consistency: Progress' consistency calendar; Home's Consistency and Training Load cards
 * - balance: Progress' Training Balance
 * - goals: Profile's Goals card; Settings' Goals row
 * - health: the Apple Health readiness trim (Home, Train, check-in) and the heart-rate deload nudge (deload.ts)
 * - coaching: check-in's load-improvement, coaching and plan-fit notes
 * - symptoms: check-in's symptom tags on a low-energy day
 * - history: Settings' whole DATA section, Weight History, sleep and nutrition
 *   trends/history, Progress' day detail, and log.tsx's backfill hub
 *
 * The core loop — the daily check-in and the plan it builds — is never gated.
 */
export type PlusFeature =
  | 'strength'
  | 'consistency'
  | 'balance'
  | 'goals'
  | 'health'
  | 'coaching'
  | 'symptoms'
  | 'history';

export type PlusFeatureGroup = 'progress' | 'training';

/** The paywall lists Plus in two skimmable groups: what you get to see, and
 * how the plan itself gets smarter. */
export const PLUS_FEATURE_GROUPS: { id: PlusFeatureGroup; title: string }[] = [
  { id: 'progress', title: 'See your progress' },
  { id: 'training', title: 'Train smarter' },
];

export const PLUS_FEATURES: {
  id: PlusFeature;
  group: PlusFeatureGroup;
  icon: Parameters<typeof SymbolView>[0]['name'];
  title: string;
  detail: string;
}[] = [
  {
    id: 'strength',
    group: 'progress',
    icon: 'chart.line.uptrend.xyaxis',
    title: 'Strength progress',
    detail: 'Estimated 1RM and relative strength, lift by lift — with PR alerts.',
  },
  {
    id: 'consistency',
    group: 'progress',
    icon: 'calendar',
    // Not "training load" alone — Progress has a free TRAINING LOAD section.
    title: 'Consistency calendar & weekly load',
    detail: 'The day-by-day calendar, plus the weekly load card on Home.',
  },
  {
    id: 'balance',
    group: 'progress',
    icon: 'chart.bar.fill',
    title: 'Training balance',
    detail: 'The full radar and movement-pattern breakdown.',
  },
  {
    id: 'goals',
    group: 'progress',
    icon: 'target',
    title: 'Goals',
    detail: 'A target lift and weight, with progress rings and trend charts.',
  },
  {
    id: 'health',
    group: 'training',
    icon: 'heart.fill',
    title: 'Apple Health readiness',
    detail: 'Resting heart rate and sleep from Apple Health trim a session when recovery looks low — and the plan tells you why.',
  },
  {
    id: 'coaching',
    group: 'training',
    icon: 'sparkles',
    title: 'Coaching & plan-fit notes',
    detail: 'Notes on load, progress and plan fit — only when the pattern is real.',
  },
  {
    id: 'symptoms',
    group: 'training',
    icon: 'bandage.fill',
    // "Tagging", not "tracking": Settings' Ongoing Symptoms is free. The
    // examples are real SYMPTOM_TAGS (symptom-tags.ts).
    title: 'Symptom tagging',
    detail: "On a low-energy day, tag soreness, stress, poor sleep, nausea and more — today's session adapts.",
  },
  {
    id: 'history',
    group: 'progress',
    icon: 'archivebox.fill',
    title: 'Your full history',
    detail: 'Weight, measurements, photos, sleep and nutrition — and backfilling past days.',
  },
];

export function isPlusFeature(value: unknown): value is PlusFeature {
  return typeof value === 'string' && PLUS_FEATURES.some((f) => f.id === value);
}

/** Opens the paywall, leading with `feature` when a locked one was tapped. */
export function openPaywall(feature?: PlusFeature): void {
  router.push((feature ? { pathname: '/paywall', params: { feature } } : '/paywall') as never);
}
