import { localDateStr } from '@/lib/local-date';
import {
  getLoadImprovementNote,
  getPacingTrendNote,
  getPostSessionNote,
  getShareableWeeklyRecapText,
  getWeeklyRecap,
} from '@/lib/momentum';
import type { SessionHistoryEntry } from '@/lib/session-history';
import type { RecordPerformanceResult } from '@/lib/exercise-performance';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function makeEntry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return { date: daysAgoStr(0), completed: true, ...overrides };
}

describe('getWeeklyRecap', () => {
  it('returns null for a quiet week — blameless silence, never a discouraging message', () => {
    expect(getWeeklyRecap({ completedCount: 0, scheduledCount: 5 })).toBeNull();
  });

  it('uses singular phrasing for exactly 1 session', () => {
    expect(getWeeklyRecap({ completedCount: 1, scheduledCount: 5 })).toBe('1 session this week');
  });

  it('uses plural phrasing for more than 1 session', () => {
    expect(getWeeklyRecap({ completedCount: 3, scheduledCount: 5 })).toBe('3 sessions this week');
  });
});

describe('getPostSessionNote', () => {
  it('returns a note for a real low-energy day (1 or 2)', () => {
    expect(getPostSessionNote(1)).not.toBeNull();
    expect(getPostSessionNote(2)).not.toBeNull();
  });

  it('returns null (silence) for an ordinary or good energy day', () => {
    expect(getPostSessionNote(3)).toBeNull();
    expect(getPostSessionNote(4)).toBeNull();
    expect(getPostSessionNote(5)).toBeNull();
  });
});

describe('getPacingTrendNote', () => {
  it('returns null with fewer than the minimum sample size in either window', () => {
    const entries: SessionHistoryEntry[] = [makeEntry({ date: daysAgoStr(1), feedback: 'just_right' })];
    expect(getPacingTrendNote(entries)).toBeNull();
  });

  it('recognizes a real, meaningful improvement in "just right" rate between the two windows', () => {
    const entries: SessionHistoryEntry[] = [];
    // Prior window (14-18 days ago): 5 entries, 0% "just_right".
    for (let i = 14; i < 19; i++) entries.push(makeEntry({ date: daysAgoStr(i), feedback: 'too_hard' }));
    // Recent window (0-4 days ago): 5 entries, 100% "just_right".
    for (let i = 0; i < 5; i++) entries.push(makeEntry({ date: daysAgoStr(i), feedback: 'just_right' }));
    expect(getPacingTrendNote(entries)).not.toBeNull();
  });

  it('stays silent (never a discouraging note) when the rate is flat or has gotten worse', () => {
    const entries: SessionHistoryEntry[] = [];
    for (let i = 14; i < 19; i++) entries.push(makeEntry({ date: daysAgoStr(i), feedback: 'just_right' }));
    for (let i = 0; i < 5; i++) entries.push(makeEntry({ date: daysAgoStr(i), feedback: 'too_hard' }));
    expect(getPacingTrendNote(entries)).toBeNull();
  });

  it('ignores entries with no feedback at all', () => {
    const entries: SessionHistoryEntry[] = [];
    for (let i = 0; i < 10; i++) entries.push(makeEntry({ date: daysAgoStr(i) }));
    expect(getPacingTrendNote(entries)).toBeNull();
  });
});

describe('getLoadImprovementNote', () => {
  function makeResult(improved: boolean, ratio = 1): RecordPerformanceResult {
    return {
      previous: null,
      current: { weightKg: 50, reps: 8, estimatedOneRepMax: 60, date: daysAgoStr(0), improved },
      oneRepMaxRatio: ratio,
    };
  }

  it('returns null when nothing improved this session', () => {
    const results = [{ exerciseName: 'Bench Press', result: makeResult(false) }];
    expect(getLoadImprovementNote(results)).toBeNull();
  });

  it('names the improved exercise when exactly one improved', () => {
    const results = [{ exerciseName: 'Squat', result: makeResult(true, 1.1) }];
    expect(getLoadImprovementNote(results)).toContain('Squat');
  });

  it('names only the single biggest jump when multiple exercises improved', () => {
    const results = [
      { exerciseName: 'Small Gain', result: makeResult(true, 1.03) },
      { exerciseName: 'Big Gain', result: makeResult(true, 1.25) },
    ];
    const note = getLoadImprovementNote(results);
    expect(note).toContain('Big Gain');
    expect(note).not.toContain('Small Gain');
  });
});

describe('getShareableWeeklyRecapText', () => {
  it('returns null on a quiet week — no share content fabricated', () => {
    expect(getShareableWeeklyRecapText({ completedCount: 0, scheduledCount: 5 })).toBeNull();
  });

  it('includes the real weekly count when there is something to share', () => {
    const text = getShareableWeeklyRecapText({ completedCount: 2, scheduledCount: 5 });
    expect(text).toContain('2 sessions this week');
  });

  it('adds the strength-gain highlight only when one is actually provided', () => {
    const withGain = getShareableWeeklyRecapText(
      { completedCount: 1, scheduledCount: 5 },
      { exerciseName: 'Deadlift', estimatedOneRepMaxKg: 123.4 }
    );
    expect(withGain).toContain('Deadlift');
    expect(withGain).toContain('123 kg');

    const withoutGain = getShareableWeeklyRecapText({ completedCount: 1, scheduledCount: 5 }, null);
    expect(withoutGain).not.toContain('1RM');
  });
});
