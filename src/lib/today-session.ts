import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EnergyScore } from '@/components/home/energy-gauge';
import { localDateStr } from '@/lib/local-date';
import type { BodyArea } from '@/lib/plan-preview';

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
  /** Vervein addition — an explicit body-area choice from check-in.tsx's
   * rest-day "check in anyway" flow only (see that screen's own isRestDay
   * gate), fed to plan-preview.ts's own preferredBodyArea param so Home/
   * Train's own preview reads reflect the same choice check-in.tsx already
   * resolved, not a history-blind re-guess. Undefined for every entry saved
   * before this field existed, and for every normal (non-override) day. */
  preferredBodyArea?: BodyArea;
  /** Vervein addition — check-in.tsx's own "Where are you working out
   * today?" answer, in the same onboarding-vocabulary keys the profile's
   * standing `environment` field uses (see plan-preview.ts's own
   * equipmentOverride param). Undefined means today's equipment matches the
   * standing profile — the common case, and every entry saved before this
   * field existed. */
  equipmentOverride?: string;
  /** BUG FIX (found in a later full-app audit): the actual weights typed
   * for each exercise during a session used to live only in check-in.tsx's
   * React state until Finish — exercise *completion* was already durably
   * autosaved per-exercise (workout-log.ts), but the numbers themselves
   * weren't, so an app kill mid-session (OS memory pressure, an incoming
   * call, a force-quit) silently lost every typed weight even though the
   * session still showed those exercises as completed on reopen. Debounced-
   * autosaved during an active (resolved, not yet done) session only —
   * cleared (passed as undefined, which JSON.stringify simply omits) once
   * Finish actually records them via exercise-performance.ts, since at that
   * point they're durably captured elsewhere and don't need to keep living
   * here too. Keyed by exercise index, same as check-in.tsx's own
   * loggedWeightsKg state this mirrors. */
  loggedWeightsKg?: Record<number, string>;
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
  finisherAccepted?: boolean,
  preferredBodyArea?: BodyArea,
  equipmentOverride?: string,
  loggedWeightsKg?: Record<number, string>
) {
  try {
    const session: TodaySession = {
      date: today(),
      energy,
      completed,
      symptomTags,
      timeAvailableMin,
      finisherAccepted,
      preferredBodyArea,
      equipmentOverride,
      loggedWeightsKg,
    };
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
