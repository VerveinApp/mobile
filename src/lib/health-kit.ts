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
] as const;

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
 * principle as onboarding's health-consent screen).
 */
export async function requestHealthKitAccess(): Promise<boolean> {
  const HealthKit = await getModule();
  if (!HealthKit) return false;
  let granted = false;
  try {
    granted = await HealthKit.requestAuthorization({ toRead: [...READ_TYPES] });
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

/** Daily step totals for the last `days` days, oldest first. Empty if not connected or no data. */
export async function getRecentSteps(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const samples = await HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      filter: { date: { startDate } },
      limit: 0,
      unit: 'count',
      ascending: true,
    });
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const date = localDateStr(s.startDate);
      byDate.set(date, (byDate.get(date) ?? 0) + s.quantity);
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value: Math.round(value) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
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

  const recent = samples.slice(-3);
  const baseline = samples.slice(0, -3);
  const recentAvg = recent.reduce((sum, s) => sum + s.value, 0) / recent.length;
  const baselineAvg = baseline.reduce((sum, s) => sum + s.value, 0) / baseline.length;
  return { recentAvg, baselineAvg, ratio: recentAvg / baselineAvg };
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
 * A multiplier in [1 - READINESS_MAX_REDUCTION, 1] to apply alongside the
 * calibration multiplier in scaleVolume — inclusive lower bound, reached
 * exactly at >=15% RHR elevation (Math.min caps there, doesn't approach it
 * asymptotically). 1 means "no adjustment" — either RHR isn't elevated, or
 * there isn't enough real data yet.
 */
export async function getHealthReadinessModifier(): Promise<number> {
  const trend = await getRestingHeartRateTrend();
  if (!trend || trend.ratio <= 1) return 1;
  const elevation = trend.ratio - 1;
  return 1 - Math.min(elevation, READINESS_MAX_REDUCTION);
}

/**
 * Total sleep hours per night for the last `days` days. HealthKit returns
 * one row per sleep *segment* (a night can be several rows — asleep/awake/
 * core/deep/REM stages depending on the source device), so this sums
 * segment durations per calendar date rather than assuming one row = one
 * night.
 */
export async function getRecentSleepHours(days: number): Promise<DailyMetric[]> {
  const HealthKit = await getModule();
  if (!HealthKit || !(await hasConnectedHealthKit())) return [];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate } },
      limit: 0,
    });
    // asleepUnspecified and asleep share numeric value 1 in the SDK's own
    // enum — inBed (0) and awake (2) segments are deliberately excluded,
    // only real asleep time counts.
    const asleepValues = new Set<number>([1, 3, 4, 5]);
    const hoursByDate = new Map<string, number>();
    for (const sample of samples) {
      if (!asleepValues.has(sample.value as unknown as number)) continue;
      const date = localDateStr(sample.startDate);
      const hours = (sample.endDate.getTime() - sample.startDate.getTime()) / 3_600_000;
      hoursByDate.set(date, (hoursByDate.get(date) ?? 0) + hours);
    }
    return Array.from(hoursByDate.entries())
      .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
