import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateStr } from '@/lib/local-date';

// iOS-only, read-only wrapper around @kingstinct/react-native-healthkit.
// HealthKit itself never tells an app which individual read permissions
// were actually granted (Apple deliberately withholds this to prevent
// permission fingerprinting) — requestAuthorization's resolved boolean only
// reports whether the request dialog itself completed without error.
// CONNECTED_KEY tracks "the user went through the connect flow," not "every
// read type is granted"; every read function below already treats an empty
// result as the honest default (no data, not an error) rather than
// assuming denial or fabricating a fallback number.
const CONNECTED_KEY = 'vervein.healthKitConnected.v1';
const BANNER_DISMISSED_KEY = 'vervein.healthKitBannerDismissed.v1';

export type DailyMetric = { date: string; value: number };

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;

// The one writeable type this app asks for — a completed session showing up
// in Apple Health/Fitness is data portability, not new insight, so it's
// requested alongside the read types in the same one-time prompt rather
// than a separate ask later.
const WRITE_TYPES = ['HKWorkoutTypeIdentifier'] as const;

// WorkoutActivityType's real numeric values, per the SDK's own generated
// enum (@kingstinct/react-native-healthkit's healthkit.generated.d.ts) —
// used as literals with a type-only import below rather than importing the
// enum itself as a value, since it's generated purely for typing and this
// avoids depending on it being a real runtime export.
const WORKOUT_ACTIVITY_TYPE_BY_GOAL: Record<string, number> = {
  'build-physique': 50, // traditionalStrengthTraining
  'get-stronger': 50, // traditionalStrengthTraining
  'get-leaner': 73, // mixedCardio
  'move-better': 62, // flexibility
};
const WORKOUT_ACTIVITY_TYPE_OTHER = 3000; // other — honest fallback for an unrecognized/missing goal

async function getModule() {
  if (Platform.OS !== 'ios') return null;
  return import('@kingstinct/react-native-healthkit');
}

export async function isHealthKitAvailable(): Promise<boolean> {
  const HealthKit = await getModule();
  if (!HealthKit) return false;
  try {
    return await HealthKit.isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export async function hasConnectedHealthKit(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONNECTED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Dismissing the Home banner is separate from connecting — a user who says
 * "not now" shouldn't be nagged again, but can still connect later from
 * Settings. */
export async function isHealthKitBannerDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BANNER_DISMISSED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function dismissHealthKitBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  } catch {
    // Worst case the banner reappears next load — not a crash.
  }
}

/**
 * Triggers the real iOS permission dialog. Only call this from a user
 * action (a tap on the "Connect" banner) — never on app load, per the
 * app's standing rule that health-adjacent asks explain why first (same
 * principle as onboarding's health-consent screen). Requests write access
 * for workouts (WRITE_TYPES) in the same prompt as the read types — see
 * saveCompletedWorkout below for the one place that's actually used.
 */
export async function requestHealthKitAccess(): Promise<boolean> {
  const HealthKit = await getModule();
  if (!HealthKit) return false;
  let granted = false;
  try {
    granted = await HealthKit.requestAuthorization({ toRead: [...READ_TYPES], toShare: [...WRITE_TYPES] });
  } catch {
    granted = false;
  }
  if (granted) {
    try {
      await AsyncStorage.setItem(CONNECTED_KEY, 'true');
    } catch {
      // Worst case the banner reappears next time — not a crash.
    }
  }
  return granted;
}

export async function disconnectHealthKit(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONNECTED_KEY);
  } catch {
    // Best-effort — same as never having connected.
  }
}

/**
 * Local-midnight window for a daily statistics collection: an anchor at
 * today's midnight (so every bucket is one real local calendar day) and a
 * start `days - 1` midnights back (so the window is exactly `days` days).
 */
function dailyStatisticsWindow(days: number): { anchorDate: Date; startDate: Date } {
  const anchorDate = new Date();
  anchorDate.setHours(0, 0, 0, 0);
  const startDate = new Date(anchorDate);
  startDate.setDate(anchorDate.getDate() - (days - 1));
  return { anchorDate, startDate };
}

/** Maps a daily statistics collection to this module's DailyMetric shape —
 * days with no data at all are left out, same as the old per-sample sums. */
function toDailyMetrics(buckets: readonly { startDate?: Date; sumQuantity?: { quantity: number } }[]): DailyMetric[] {
  return buckets
    .flatMap((bucket) =>
      bucket.startDate && bucket.sumQuantity
        ? [{ date: localDateStr(bucket.startDate), value: Math.round(bucket.sumQuantity.quantity) }]
        : []
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Daily step totals for the last `days` days, oldest first. Empty if not
 * connected or no data.
 *
 * BUG FIX: this used to add up raw samples — but an iPhone and an Apple
 * Watch both record steps for the same walk, and HealthKit keeps both, so
 * every Watch owner's totals came out close to double. A cumulative-sum
 * statistics query is HealthKit's own de-duplicated total (the same number
 * the Health app shows), bucketed by local calendar day.
 */
export async function getRecentSteps(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  const { anchorDate, startDate } = dailyStatisticsWindow(days);
  try {
    const buckets = await HealthKit.queryStatisticsCollectionForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      anchorDate,
      { day: 1 },
      { filter: { date: { startDate } }, unit: 'count' }
    );
    return toDailyMetrics(buckets);
  } catch {
    return [];
  }
}

/** Daily active-energy (kcal) totals for the last `days` days, oldest first.
 * Empty if not connected or no data — same de-duplicated statistics query
 * as getRecentSteps above (and the same iPhone+Watch double-count fix). */
export async function getRecentActiveEnergy(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  const { anchorDate, startDate } = dailyStatisticsWindow(days);
  try {
    const buckets = await HealthKit.queryStatisticsCollectionForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      anchorDate,
      { day: 1 },
      { filter: { date: { startDate } }, unit: 'kcal' }
    );
    return toDailyMetrics(buckets);
  } catch {
    return [];
  }
}

/**
 * This week's real active-energy total (Monday through today, local
 * calendar) — same week boundary session-history.ts's own
 * getWeeklyCaloriesBurned uses, so a caller combining both sources is
 * always comparing the same window. Returns null specifically when
 * HealthKit isn't connected — distinct from a real, connected 0 — so a
 * caller can tell "no real source, fall back to the on-device estimate"
 * apart from "the real source genuinely says zero so far this week."
 */
export async function getWeeklyActiveEnergyKcal(): Promise<number | null> {
  if (!(await hasConnectedHealthKit())) return null;
  const daily = await getRecentActiveEnergy(7);
  const now = new Date();
  const todayIndex = now.getDay();
  const mondayOffset = (todayIndex + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const mondayStr = localDateStr(monday);
  const todayStr = localDateStr(now);
  return daily.filter((d) => d.date >= mondayStr && d.date <= todayStr).reduce((sum, d) => sum + d.value, 0);
}

/**
 * One resting-heart-rate value per real day for the last `days` days,
 * oldest first. Empty if not connected or no data. HealthKit can emit more
 * than one RHR sample per day (multiple sources, recalculation) — averaged
 * per calendar date rather than returned 1:1 per sample, same aggregation
 * getRecentSteps/getRecentSleepHours already do, so getRestingHeartRateTrend's
 * "last 3 entries" really means the last 3 real days, not the last 3 samples.
 */
export async function getRecentRestingHeartRate(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const samples = await HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      filter: { date: { startDate } },
      limit: 0,
      unit: 'count/min',
      ascending: true,
    });
    const byDate = new Map<string, { total: number; count: number }>();
    for (const s of samples) {
      const date = localDateStr(s.startDate);
      const entry = byDate.get(date) ?? { total: 0, count: 0 };
      entry.total += s.quantity;
      entry.count += 1;
      byDate.set(date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, { total, count }]) => ({ date, value: Math.round(total / count) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

const RHR_MIN_BASELINE_DAYS = 4;
// Vervein UX threshold, not a clinical one (same status as RETURN_GAP_MIN_DAYS
// in plan-preview.ts) — how stale the newest sample can be before "recent"
// stops meaning recent. getRecentRestingHeartRate(10) is a *calendar-day*
// lookback, but its result is one entry per real day *with data*, so a gap
// near the end (watch not worn the last day or two) let `samples.slice(-3)`
// quietly reach further back than "recent" implies, while getHealthReadinessModifier
// still described it in the present tense. Gating on the newest sample's own
// recency — not just having "enough" samples somewhere in the window —
// closes that: under-triggering is always the safe failure mode, per this
// function's own principle below.
const RHR_FRESHNESS_MAX_DAYS = 2;

export type RestingHeartRateTrend = { recentAvg: number; baselineAvg: number; ratio: number };

/**
 * Real, self-normalized recovery signal: the last 3 days' average resting
 * heart rate against the trailing baseline before that — never an absolute
 * bpm target, same principle as the Training Balance radar. `ratio > 1`
 * means recent RHR is elevated relative to the user's own baseline. Null
 * when there isn't enough real data to say anything — under-triggering is
 * always the safe failure mode. Shared by deload.ts (the advisory banner)
 * and plan-preview.ts (the real volume adjustment) so both read the exact
 * same real trend, not two independently-computed numbers.
 */
export async function getRestingHeartRateTrend(): Promise<RestingHeartRateTrend | null> {
  const samples = await getRecentRestingHeartRate(10); // oldest-first
  if (samples.length < RHR_MIN_BASELINE_DAYS + 3) return null;

  const newest = samples[samples.length - 1];
  const daysSinceNewest = Math.round(
    (Date.parse(`${localDateStr()}T00:00:00Z`) - Date.parse(`${newest.date}T00:00:00Z`)) / 86400000
  );
  if (daysSinceNewest > RHR_FRESHNESS_MAX_DAYS) return null;

  const recent = samples.slice(-3);
  const baseline = samples.slice(0, -3);
  const recentAvg = recent.reduce((sum, s) => sum + s.value, 0) / recent.length;
  const baselineAvg = baseline.reduce((sum, s) => sum + s.value, 0) / baseline.length;
  return { recentAvg, baselineAvg, ratio: recentAvg / baselineAvg };
}

/**
 * Settings' own "Last synced" line (Vervein addition) — separate from the
 * silent-by-default insights elsewhere (deload.ts's banner, plan-preview.ts's
 * volume adjustment): those stay quiet on purpose when data's missing
 * (momentum.ts/coaching-insights.ts/plan-fit.ts all follow the same "silence
 * is valid, never a placeholder" rule), but someone who went through the
 * effort of connecting HealthKit and never sees the readiness signal fire
 * has a fair "is this actually working?" question. Settings is the
 * diagnostic surface, not the daily-use one, so it's the one place that
 * answers it directly instead of leaving it to be inferred from an absence.
 * Null means no resting-heart-rate sample at all in the last 10 days.
 */
export async function getLastRestingHeartRateSyncDate(): Promise<string | null> {
  const samples = await getRecentRestingHeartRate(10);
  return samples.length > 0 ? samples[samples.length - 1].date : null;
}

// The one place real HealthKit data actually changes what the engine
// produces (see plan-preview.ts). Deliberately one-directional and capped:
// an elevated RHR can only ever trim volume, never boost it above what the
// user's own energy score already implies — mirrors M9's own P1 governance
// language ("conservative interim: reduce and say so") rather than
// introducing a new policy stance. Capped at a 15% reduction so one noisy
// reading can't swing a session drastically; always surfaced in the
// explanation string, never a silent adjustment.
const READINESS_MAX_REDUCTION = 0.15;

/**
 * Both real readiness signals in one place, since getHealthReadinessModifier
 * and getHealthReadinessReasons both need them and neither should silently
 * drift from the other's idea of "what counts as elevated/short." Two
 * independent HealthKit reads either way (this doesn't cache across the two
 * exported calls below) — both are cheap local queries, not network calls,
 * so computing them twice on the rare occasion a caller wants both the
 * modifier and the reasons is a non-issue.
 */
async function getReadinessTrends(): Promise<{
  rhrTrend: RestingHeartRateTrend | null;
  sleepTrend: SleepDebtTrend | null;
}> {
  const [rhrTrend, sleepTrend] = await Promise.all([getRestingHeartRateTrend(), getSleepDebtTrend()]);
  return { rhrTrend, sleepTrend };
}

/**
 * A multiplier in [1 - READINESS_MAX_REDUCTION, 1] to apply alongside the
 * calibration multiplier in scaleVolume. Both real signals contribute
 * additively to ONE capped reduction (never each independently capped and
 * summed) — an elevated RHR and a short night can both be real at once, but
 * the combined trim still can never exceed READINESS_MAX_REDUCTION, same
 * "one noisy reading can't swing a session drastically" guarantee as
 * before, just now honoring it across two signals instead of one. 1 means
 * "no adjustment" — neither signal is real, or there isn't enough data yet
 * for either.
 */
export async function getHealthReadinessModifier(): Promise<number> {
  const { rhrTrend, sleepTrend } = await getReadinessTrends();
  let deficit = 0;
  if (rhrTrend && rhrTrend.ratio > 1) deficit += rhrTrend.ratio - 1;
  if (sleepTrend && sleepTrend.ratio < 1) deficit += 1 - sleepTrend.ratio;
  return 1 - Math.min(deficit, READINESS_MAX_REDUCTION);
}

export type HealthReadinessReasons = { rhrElevated: boolean; sleepDeficit: boolean };

/**
 * Which real signal(s) actually drove getHealthReadinessModifier's number —
 * plan-preview.ts's own explanation text needs this to stay honest once
 * there are two possible causes instead of one (see that file's own
 * "never an overclaimed adjustment" comment on the sentence this feeds).
 * Deliberately mirrors getHealthReadinessModifier's own thresholds exactly
 * (same getReadinessTrends call, same ratio comparisons) rather than
 * re-deriving them, so the reported reason can never disagree with the
 * modifier it's explaining.
 */
export async function getHealthReadinessReasons(): Promise<HealthReadinessReasons> {
  const { rhrTrend, sleepTrend } = await getReadinessTrends();
  return {
    rhrElevated: !!rhrTrend && rhrTrend.ratio > 1,
    sleepDeficit: !!sleepTrend && sleepTrend.ratio < 1,
  };
}

// A "sleep day" runs 6pm to 6pm: anything that ENDS after 6pm counts toward
// the next day's night. So a night from 11pm to 7am lands entirely on the
// day you woke up, an early bedtime (9pm) joins the rest of that night, and
// an afternoon nap stays on the day it happened.
const SLEEP_DAY_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * Pure core of getRecentSleepHours, exported for tests. Two real bugs this
 * replaces:
 *
 * 1. Segments used to be bucketed by the date they STARTED — so the part of
 *    "last night" before midnight landed on yesterday, and today's bucket
 *    only held the hours after midnight. Anyone who falls asleep before
 *    midnight always looked short against their baseline, and Plus users'
 *    plans were trimmed for a "sleep deficit" after a normal night.
 * 2. Overlapping segments were summed — an Apple Watch, the iPhone, and a
 *    third-party sleep app can all record the same night — inflating totals.
 *    Overlaps are merged into one continuous interval first.
 */
export function sleepHoursByNight(intervals: readonly { start: Date; end: Date }[]): DailyMetric[] {
  const sorted = intervals
    .map(({ start, end }) => [start.getTime(), end.getTime()] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const hoursByDate = new Map<string, number>();
  for (const [start, end] of merged) {
    const date = localDateStr(new Date(end + SLEEP_DAY_OFFSET_MS));
    hoursByDate.set(date, (hoursByDate.get(date) ?? 0) + (end - start) / 3_600_000);
  }
  return Array.from(hoursByDate.entries())
    .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Total sleep hours per night for the last `days` nights, oldest first —
 * see sleepHoursByNight for how segments become nights. HealthKit returns
 * one row per sleep *segment* (a night can be several rows — asleep/awake/
 * core/deep/REM stages depending on the source device).
 */
export async function getRecentSleepHours(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  // An extra half day back so the oldest night's pre-midnight start is in
  // the query too; the partial bucket that can create is trimmed below.
  const startDate = new Date(Date.now() - (days * 24 + 12) * 60 * 60 * 1000);
  const oldestDate = localDateStr(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  try {
    const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate } },
      limit: 0,
    });
    // asleepUnspecified and asleep share numeric value 1 in the SDK's own
    // enum — inBed (0) and awake (2) segments are deliberately excluded,
    // only real asleep time counts.
    const asleepValues = new Set<number>([1, 3, 4, 5]);
    const intervals = samples
      .filter((sample) => asleepValues.has(sample.value as unknown as number))
      .map((sample) => ({ start: sample.startDate, end: sample.endDate }));
    return sleepHoursByNight(intervals).filter((night) => night.date >= oldestDate);
  } catch {
    return [];
  }
}

// Same status as RHR_MIN_BASELINE_DAYS/RHR_FRESHNESS_MAX_DAYS above — a
// Vervein UX threshold, not a clinical one.
const SLEEP_MIN_BASELINE_NIGHTS = 4;
const SLEEP_FRESHNESS_MAX_DAYS = 2;

export type SleepDebtTrend = { recentHours: number; baselineAvgHours: number; ratio: number };

/**
 * Real, self-normalized sleep signal: last night against this person's own
 * trailing baseline — never an absolute "8 hours" target, same principle
 * as getRestingHeartRateTrend. A 1-night "recent" window, not RHR's 3 —
 * sleep's effect on next-day readiness is immediate in a way RHR's slower
 * multi-day trend deliberately isn't (WHOOP's own public model ties a
 * single night's sleep directly to next-day strain recommendations, not a
 * multi-night average). `ratio < 1` means last night was short relative to
 * this person's own typical night. Null when there isn't enough real data
 * to say anything — under-triggering is always the safe failure mode, same
 * rule as the RHR trend.
 */
export async function getSleepDebtTrend(): Promise<SleepDebtTrend | null> {
  const samples = await getRecentSleepHours(10); // oldest-first
  if (samples.length < SLEEP_MIN_BASELINE_NIGHTS + 1) return null;

  const newest = samples[samples.length - 1];
  const daysSinceNewest = Math.round(
    (Date.parse(`${localDateStr()}T00:00:00Z`) - Date.parse(`${newest.date}T00:00:00Z`)) / 86400000
  );
  if (daysSinceNewest > SLEEP_FRESHNESS_MAX_DAYS) return null;

  const recentHours = newest.value;
  const baseline = samples.slice(0, -1);
  const baselineAvgHours = baseline.reduce((sum, s) => sum + s.value, 0) / baseline.length;
  return { recentHours, baselineAvgHours, ratio: recentHours / baselineAvgHours };
}

/**
 * Writes a completed session back to Apple Health as a real HKWorkout —
 * the only write this app does, and deliberately free (not gated behind
 * Plus): unlike the readiness modifier above, this isn't new insight, it's
 * just data portability for someone who already tracks their training in
 * Apple Health/Fitness elsewhere. Only call this for a real completion
 * (never a skipped session) — see check-in.tsx's handleFinishSession, the
 * one call site. `activeEnergyKcal` is optional and only ever a real
 * estimate (see calorie-estimate.ts) — omitted entirely (not zeroed) when
 * there's nothing honest to report, e.g. no bodyweight on file.
 * Silent no-op if HealthKit isn't connected or the write itself fails;
 * never surfaced to the user, same as every other HealthKit read above —
 * this is a nice-to-have sync, not something worth interrupting a just-
 * finished session over.
 */
export async function saveCompletedWorkout(
  goal: string | undefined,
  startedAt: Date,
  endedAt: Date,
  activeEnergyKcal?: number
): Promise<void> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return;
  const activityType = (goal && WORKOUT_ACTIVITY_TYPE_BY_GOAL[goal]) ?? WORKOUT_ACTIVITY_TYPE_OTHER;
  const quantities =
    activeEnergyKcal !== undefined
      ? [
          {
            startDate: startedAt,
            endDate: endedAt,
            quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
            quantity: activeEnergyKcal,
            unit: 'kcal',
          },
        ]
      : [];
  try {
    await HealthKit.saveWorkoutSample(
      activityType as Parameters<typeof HealthKit.saveWorkoutSample>[0],
      quantities as Parameters<typeof HealthKit.saveWorkoutSample>[1],
      startedAt,
      endedAt
    );
  } catch {
    // Worst case this one session doesn't show up in Apple Health — not a
    // crash, and nothing else in the app depends on this write succeeding.
  }
}
