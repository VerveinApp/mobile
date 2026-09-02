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
  /** Symptom tags picked at check-in time (see lib/symptom-tags.ts) — persisted alongside energy so reopening the app same-day re-derives the identical plan, not a symptom-blind one. */
  symptomTags: string[];
  /** Minutes picked at check-in time, if any (see plan-preview.ts's own
   * time-ceiling trim step) — undefined (not a default number) for entries
   * saved before this field existed, and for anyone who never picks a time,
   * since "no constraint" and "picked a specific number" are genuinely
   * different states, not the same thing defaulted. */
  timeAvailableMin?: number;
  /** Whether the Energy-5 optional finisher was accepted at check-in time
   * (see plan-preview.ts's own finisherAccepted param) — undefined (not
   * `false`) for entries saved before this field existed, same
   * absent-vs-declined distinction timeAvailableMin already draws. Only ever
   * meaningful at energy 5; check-in.tsx resets it the moment energy changes
   * away from 5, so a stored `true` alongside a non-5 energy should never
   * actually occur, but this stays optional rather than required regardless. */
  finisherAccepted?: boolean;
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
    if (parsed.date !== today()) return null;
    // Entries saved before symptomTags existed won't have the field.
    return { ...parsed, symptomTags: parsed.symptomTags ?? [] };
  } catch {
    return null;
  }
}

export async function saveTodaySession(
  energy: EnergyScore,
  completed: boolean,
  symptomTags: string[] = [],
  timeAvailableMin?: number,
  finisherAccepted?: boolean
) {
  try {
    const session: TodaySession = { date: today(), energy, completed, symptomTags, timeAvailableMin, finisherAccepted };
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
