import {
  addConditionLogEntry,
  clearConditionLog,
  deleteConditionLogEntry,
  getConditionLog,
  restoreConditionLog,
  type ConditionLogEntry,
} from '@/lib/condition-log';

describe('condition-log', () => {
  afterEach(async () => {
    await clearConditionLog();
  });

  it('returns an empty list when nothing has been logged', async () => {
    expect(await getConditionLog()).toEqual([]);
  });

  it('addConditionLogEntry then getConditionLog round-trips a real entry', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid', 'felt off today');
    const log = await getConditionLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: 'id-1', date: '2026-06-01', condition: 'thyroid', note: 'felt off today' });
    expect(typeof log[0].createdAt).toBe('string');
  });

  it('two entries on the same date both survive — unlike weight-log, a day can hold more than one entry', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid');
    await addConditionLogEntry('id-2', '2026-06-01', 'pcos');
    expect(await getConditionLog()).toHaveLength(2);
  });

  it('trims and stores an empty note as undefined rather than an empty string', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid', '   ');
    const log = await getConditionLog();
    expect(log[0].note).toBeUndefined();
  });

  it('getConditionLog sorts most-recent-date-first, then most-recently-created within the same date', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid');
    await addConditionLogEntry('id-2', '2026-06-03', 'pcos');
    await addConditionLogEntry('id-3', '2026-06-02', 'iron_deficiency');
    expect((await getConditionLog()).map((e) => e.id)).toEqual(['id-2', 'id-3', 'id-1']);
  });

  it('deleteConditionLogEntry removes only the targeted entry by id', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid');
    await addConditionLogEntry('id-2', '2026-06-01', 'pcos');
    await deleteConditionLogEntry('id-1');
    const log = await getConditionLog();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe('id-2');
  });

  it('clearConditionLog wipes every entry', async () => {
    await addConditionLogEntry('id-1', '2026-06-01', 'thyroid');
    await clearConditionLog();
    expect(await getConditionLog()).toEqual([]);
  });

  it('restoreConditionLog overwrites the whole log wholesale', async () => {
    const entries: ConditionLogEntry[] = [
      { id: 'id-1', date: '2026-06-01', condition: 'thyroid', createdAt: '2026-06-01T08:00:00.000Z' },
    ];
    await restoreConditionLog(entries);
    expect(await getConditionLog()).toEqual(entries);
  });
});
