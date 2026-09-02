/**
 * M16 — Deload/Pattern Nudge Module, ported from the adaptive-engine
 * research vault's src/modules/m16-deload-nudge.ts (logic verbatim, the
 * `persistence` storage dependency removed — see lib/deload.ts for the
 * AsyncStorage-backed wrapper, same split as personal-calibration.ts). A
 * pure read-and-derive function: never writes state.
 *
 * THE FLAGGED AMBIGUITY THIS MODULE MUST NOT SILENTLY RESOLVE: "three
 * consecutive Energy Score = 1" is ambiguous between calendar-consecutive
 * and check-in-consecutive. This implements the vault's own documented
 * interim (Implementation Discoveries, 2026-07-22): trigger ONLY when both
 * readings agree — the last three logged sessions are all Energy Score 1
 * AND fall on three consecutive calendar days. Every nudge this emits is
 * correct under either interpretation; divergent cases deliberately don't
 * trigger until governance picks a rule. Conservative intersection, not a
 * resolution.
 *
 * SCOPE NOTE, corrected — this used to say session-history.ts only logs
 * completed sessions and so this pattern could only be detected from
 * finished sessions. That's stale: check-in.tsx's handleStartSession writes
 * a real 'skipped' entry (with a real energy score) the instant a session
 * starts, specifically so someone who starts and abandons isn't invisible —
 * and lib/deload.ts's caller already reads every session-history entry with
 * a defined energy, not just completed ones. The one case still genuinely
 * unreadable here (matching the source module's "M4 records skips as energy
 * 3" for a different reason) is someone who opens check-in and closes the
 * app without ever picking an energy score at all — there's no button press
 * to hook a write into for that case, so it's a real, narrower gap, not the
 * broad one this comment used to describe.
 *
 * ORDERING NOTE — the source module's `lastThree` is oldest-first (index 0
 * is the earliest of the three). This app's session-history.ts naturally
 * returns most-recent-first, so `recentSessions` here follows that same
 * convention instead of forcing a reversal at the call site — the
 * consecutive-day check below is just mirrored to match.
 */

import type { DeloadNudge } from '@/lib/engine/types';

const NUDGE_MESSAGE = 'Consistent low energy — consider rest and check in tomorrow.';

function isNextCalendarDay(fromIso: string, toIso: string): boolean {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return to - from === 24 * 60 * 60 * 1000;
}

/** `recentSessions` must be most-recent-first; only the first three entries are read. */
export function checkDeloadPattern(recentSessions: { date: string; energy: number }[]): DeloadNudge {
  if (recentSessions.length < 3) {
    return { triggered: false, message: null };
  }
  const [newest, middle, oldest] = recentSessions;

  const allEnergyOne = newest.energy === 1 && middle.energy === 1 && oldest.energy === 1;
  const calendarConsecutive = isNextCalendarDay(oldest.date, middle.date) && isNextCalendarDay(middle.date, newest.date);

  if (allEnergyOne && calendarConsecutive) {
    return { triggered: true, message: NUDGE_MESSAGE };
  }
  return { triggered: false, message: null };
}
