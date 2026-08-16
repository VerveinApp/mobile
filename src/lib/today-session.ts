import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EnergyScore } from '@/components/home/energy-gauge';
import { localDateStr } from '@/lib/local-date';

const KEY = 'vervein.todaySession.v1';

/**
 * Today's resolved session — separate from check-in-history.ts (which only
 * remembers the single most recent energy value for comparison purposes).
 * This remembers whether *today specifically* has already been resolved, so
 * reopening the app same-day shows the resolved plan directly instead of
 * asking the user to check in again from scratch.
 */
export type TodaySession = {
  /** YYYY-MM-DD, local date this session belongs to. */
  date: string;
  energy: EnergyScore;
  completed: boolean;
};

function today() {
  return localDateStr();
}

/** Returns null if there's no session yet, or if the stored one is from a previous day. */
export async function getTodaySession(): Promise<TodaySession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TodaySession;
    return parsed.date === today() ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveTodaySession(energy: EnergyScore, completed: boolean) {
  try {
    const session: TodaySession = { date: today(), energy, completed };
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Worst case the app re-asks for a check-in it already had — same as a first check-in.
  }
}

export async function clearTodaySession() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort — same as never having a session today.
  }
}
