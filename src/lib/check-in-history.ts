import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EnergyScore } from '@/components/home/energy-gauge';
import { localDateStr } from '@/lib/local-date';

const HISTORY_KEY = 'vervein.lastCheckIn.v1';

/**
 * Only the single most recent check-in — enough to compare "how does today
 * feel against last time" and to show a ghost marker on the gauge. Not a
 * full log; that's real-engine territory, not a UI-modernization concern.
 */
export type CheckInRecord = {
  /** YYYY-MM-DD, local date the check-in was recorded. */
  date: string;
  energy: EnergyScore;
};

export async function getLastCheckIn(): Promise<CheckInRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as CheckInRecord) : null;
  } catch {
    return null;
  }
}

export async function recordCheckIn(energy: EnergyScore) {
  try {
    const record: CheckInRecord = { date: localDateStr(), energy };
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(record));
  } catch {
    // Worst case the next check-in just has no "last time" to compare against.
  }
}

export async function clearCheckInHistory() {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    // Best-effort — same as never having checked in.
  }
}
