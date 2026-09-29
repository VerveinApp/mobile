import {
  clearDecisionTraceLog,
  getDecisionTraceLog,
  recordDecisionTrace,
  restoreDecisionTraceLog,
  type StoredTrace,
} from '@/lib/decision-trace-log';

function makeTraceInput(date: string, overrides: Partial<Parameters<typeof recordDecisionTrace>[1]> = {}) {
  return {
    fallbackFired: false,
    gate1Exclusions: [],
    deliveredExercises: [{ exerciseId: 'ex_101', adapted_sets: 3 }],
    policyApplications: [],
    ...overrides,
  };
}

describe('decision-trace-log', () => {
  afterEach(async () => {
    await clearDecisionTraceLog();
  });

  it('returns an empty list when nothing has been recorded', async () => {
    expect(await getDecisionTraceLog()).toEqual([]);
  });

  it('recordDecisionTrace then getDecisionTraceLog round-trips a real trace, mapping deliveredExercises into output.exercises', async () => {
    await recordDecisionTrace('2026-06-01', makeTraceInput('2026-06-01'));
    const log = await getDecisionTraceLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      date: '2026-06-01',
      fallbackFired: false,
      output: { exercises: [{ exerciseId: 'ex_101', adapted_sets: 3 }] },
    });
  });

  it('a null adapted_sets is stored as undefined, not null — REGRESSION GUARD: matches MinimalDecisionTrace\'s own output shape exactly', async () => {
    await recordDecisionTrace(
      '2026-06-01',
      makeTraceInput('2026-06-01', { deliveredExercises: [{ exerciseId: 'ex_101', adapted_sets: null }] })
    );
    const log = await getDecisionTraceLog();
    expect(log[0].output.exercises[0].adapted_sets).toBeUndefined();
  });

  it('a second recordDecisionTrace for the same date overwrites rather than duplicating', async () => {
    await recordDecisionTrace('2026-06-01', makeTraceInput('2026-06-01', { fallbackFired: false }));
    await recordDecisionTrace('2026-06-01', makeTraceInput('2026-06-01', { fallbackFired: true }));
    const log = await getDecisionTraceLog();
    expect(log).toHaveLength(1);
    expect(log[0].fallbackFired).toBe(true);
  });

  it('getDecisionTraceLog returns entries oldest-first — REGRESSION GUARD: compileTrainingState assumes this exact ordering', async () => {
    await recordDecisionTrace('2026-06-03', makeTraceInput('2026-06-03'));
    await recordDecisionTrace('2026-06-01', makeTraceInput('2026-06-01'));
    await recordDecisionTrace('2026-06-02', makeTraceInput('2026-06-02'));
    expect((await getDecisionTraceLog()).map((e) => e.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('clearDecisionTraceLog wipes every entry', async () => {
    await recordDecisionTrace('2026-06-01', makeTraceInput('2026-06-01'));
    await clearDecisionTraceLog();
    expect(await getDecisionTraceLog()).toEqual([]);
  });

  it('restoreDecisionTraceLog overwrites the whole log wholesale, re-sorted oldest-first', async () => {
    const entries: StoredTrace[] = [
      { date: '2026-06-03', fallbackFired: false, gate1Exclusions: [], policyApplications: [], output: { exercises: [] } },
      { date: '2026-06-01', fallbackFired: false, gate1Exclusions: [], policyApplications: [], output: { exercises: [] } },
    ];
    await restoreDecisionTraceLog(entries);
    expect((await getDecisionTraceLog()).map((e) => e.date)).toEqual(['2026-06-01', '2026-06-03']);
  });
});
