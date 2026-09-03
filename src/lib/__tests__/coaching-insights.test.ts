import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCoachingInsightNote } from '@/lib/coaching-insights';
import { localDateStr } from '@/lib/local-date';
import type { SessionHistoryEntry } from '@/lib/session-history';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function makeEntry(daysAgo: number, overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return { date: daysAgoStr(daysAgo), completed: true, ...overrides };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getCoachingInsightNote', () => {
  it('returns null when no pattern is present', async () => {
    const entries = [makeEntry(0, { feedback: 'just_right' }), makeEntry(1, { feedback: 'too_hard' })];
    expect(await getCoachingInsightNote(entries)).toBeNull();
  });

  it('surfaces a note after a long unbroken streak of real "just_right" feedback', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry(i, { feedback: 'just_right' }));
    expect(await getCoachingInsightNote(entries)).not.toBeNull();
  });

  it('does not fire below the streak threshold', async () => {
    const entries = Array.from({ length: 9 }, (_, i) => makeEntry(i, { feedback: 'just_right' }));
    expect(await getCoachingInsightNote(entries)).toBeNull();
  });

  it('a skipped day (no feedback given) breaks the streak', async () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(i, { feedback: 'just_right' })),
      makeEntry(5, { completionStatus: 'skipped' }),
      ...Array.from({ length: 10 }, (_, i) => makeEntry(6 + i, { feedback: 'just_right' })),
    ];
    // The 5 most recent (newest) entries are real "just_right" but the
    // streak stops there since the very next-most-recent day broke it —
    // below CONSECUTIVE_JUST_RIGHT_THRESHOLD (10), so no note yet.
    expect(await getCoachingInsightNote(entries)).toBeNull();
  });

  it('a backfilled ("loggedRetroactively") entry is skipped over, neither counted nor breaking', async () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) => makeEntry(i, { feedback: 'just_right' })),
      makeEntry(4, { feedback: 'just_right', loggedRetroactively: true }),
      ...Array.from({ length: 4 }, (_, i) => makeEntry(5 + i, { feedback: 'just_right' })),
    ];
    // 4 + 4 = 8 real entries count toward the streak; the loggedRetroactively
    // one in the middle is invisible to it (not counted, but also doesn't
    // break it) — still below the threshold of 10 either way.
    expect(await getCoachingInsightNote(entries)).toBeNull();

    const entriesEnoughReal = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(i, { feedback: 'just_right' })),
      makeEntry(5, { feedback: 'just_right', loggedRetroactively: true }),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(6 + i, { feedback: 'just_right' })),
    ];
    // 5 + 5 = 10 real entries either side of the invisible backfilled one
    // does reach the threshold — confirms the backfilled entry really is
    // just skipped over, not silently breaking the streak either.
    expect(await getCoachingInsightNote(entriesEnoughReal)).not.toBeNull();
  });

  it('a different feedback value breaks the streak', async () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) => makeEntry(i, { feedback: 'just_right' })),
      makeEntry(10, { feedback: 'too_easy' }),
    ];
    expect(await getCoachingInsightNote(entries)).not.toBeNull();
    const entriesBroken = [
      ...Array.from({ length: 9 }, (_, i) => makeEntry(i, { feedback: 'just_right' })),
      makeEntry(9, { feedback: 'too_easy' }),
    ];
    expect(await getCoachingInsightNote(entriesBroken)).toBeNull();
  });

  it('respects the cooldown — the same pattern does not fire again immediately', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => makeEntry(i, { feedback: 'just_right' }));
    expect(await getCoachingInsightNote(entries)).not.toBeNull();
    expect(await getCoachingInsightNote(entries)).toBeNull();
  });

  it('surfaces the underselling-energy note when that pattern is real', async () => {
    // Three real (rough day -> next-day undersold) pairs, the minimum this
    // pattern requires — see countUnderselledEnergyOccurrences's own doc
    // comment for what "rough" and "undersold" mean here.
    const entries: SessionHistoryEntry[] = [
      makeEntry(5, { feedback: 'too_hard', energy: 1 }),
      makeEntry(4, { feedback: 'too_easy', energy: 1 }),
      makeEntry(3, { feedback: 'too_hard', energy: 1 }),
      makeEntry(2, { feedback: 'too_easy', energy: 1 }),
      makeEntry(1, { feedback: 'too_hard', energy: 1 }),
      makeEntry(0, { feedback: 'too_easy', energy: 1 }),
    ];
    const note = await getCoachingInsightNote(entries);
    expect(note).toContain('undersell');
  });
});
