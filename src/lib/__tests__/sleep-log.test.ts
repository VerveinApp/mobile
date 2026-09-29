import {
  clearSleepLog,
  deleteSleepEntry,
  getSleepLog,
  restoreSleepLog,
  saveSleepEntry,
  type SleepLogEntry,
} from '@/lib/sleep-log';

describe('sleep-log', () => {
  afterEach(async () => {
    await clearSleepLog();
  });

  it('returns an empty list when nothing has been logged', async () => {
    expect(await getSleepLog()).toEqual([]);
  });

  it('saveSleepEntry then getSleepLog round-trips a real entry', async () => {
    await saveSleepEntry('2026-06-01', 7.5);
    expect(await getSleepLog()).toEqual([{ date: '2026-06-01', hours: 7.5 }]);
  });

  it('a second save for the same date overwrites rather than duplicating', async () => {
    await saveSleepEntry('2026-06-01', 7.5);
    await saveSleepEntry('2026-06-01', 6);
    const log = await getSleepLog();
    expect(log).toHaveLength(1);
    expect(log[0].hours).toBe(6);
  });

  it('getSleepLog returns entries most-recent-first', async () => {
    await saveSleepEntry('2026-06-01', 7);
    await saveSleepEntry('2026-06-03', 8);
    await saveSleepEntry('2026-06-02', 6.5);
    expect((await getSleepLog()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-02', '2026-06-01']);
  });

  it('deleteSleepEntry removes only the targeted date', async () => {
    await saveSleepEntry('2026-06-01', 7);
    await saveSleepEntry('2026-06-02', 8);
    await deleteSleepEntry('2026-06-01');
    expect((await getSleepLog()).map((e) => e.date)).toEqual(['2026-06-02']);
  });

  it('clearSleepLog wipes every entry', async () => {
    await saveSleepEntry('2026-06-01', 7);
    await clearSleepLog();
    expect(await getSleepLog()).toEqual([]);
  });

  it('restoreSleepLog overwrites the whole log wholesale, sorted most-recent-first on read', async () => {
    const entries: SleepLogEntry[] = [
      { date: '2026-06-01', hours: 7 },
      { date: '2026-06-03', hours: 8 },
    ];
    await restoreSleepLog(entries);
    expect((await getSleepLog()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-01']);
  });
});
