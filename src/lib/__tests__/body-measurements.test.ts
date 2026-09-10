import {
  clearBodyMeasurements,
  deleteBodyMeasurementEntry,
  getBodyMeasurements,
  restoreBodyMeasurements,
  saveBodyMeasurementEntry,
  type BodyMeasurementEntry,
} from '@/lib/body-measurements';

describe('body-measurements', () => {
  afterEach(async () => {
    await clearBodyMeasurements();
  });

  it('returns an empty list when nothing has been logged', async () => {
    expect(await getBodyMeasurements()).toEqual([]);
  });

  it('saveBodyMeasurementEntry then getBodyMeasurements round-trips a real entry', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    expect(await getBodyMeasurements()).toEqual([{ date: '2026-06-01', waistCm: 80 }]);
  });

  it('merges fields into an existing date rather than overwriting the whole entry — unlike weight-log/nutrition-log', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    await saveBodyMeasurementEntry('2026-06-01', { chestCm: 100 });
    const log = await getBodyMeasurements();
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({ date: '2026-06-01', waistCm: 80, chestCm: 100 });
  });

  it('a later save for the same field on the same date overwrites just that field', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 78 });
    const log = await getBodyMeasurements();
    expect(log[0].waistCm).toBe(78);
  });

  it('getBodyMeasurements returns entries most-recent-first', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    await saveBodyMeasurementEntry('2026-06-03', { waistCm: 79 });
    await saveBodyMeasurementEntry('2026-06-02', { waistCm: 79.5 });
    expect((await getBodyMeasurements()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-02', '2026-06-01']);
  });

  it('deleteBodyMeasurementEntry removes only the targeted date', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    await saveBodyMeasurementEntry('2026-06-02', { waistCm: 79 });
    await deleteBodyMeasurementEntry('2026-06-01');
    expect((await getBodyMeasurements()).map((e) => e.date)).toEqual(['2026-06-02']);
  });

  it('clearBodyMeasurements wipes every entry', async () => {
    await saveBodyMeasurementEntry('2026-06-01', { waistCm: 80 });
    await clearBodyMeasurements();
    expect(await getBodyMeasurements()).toEqual([]);
  });

  it('restoreBodyMeasurements overwrites the whole log wholesale, sorted most-recent-first on read', async () => {
    const entries: BodyMeasurementEntry[] = [
      { date: '2026-06-01', waistCm: 80 },
      { date: '2026-06-03', waistCm: 79 },
    ];
    await restoreBodyMeasurements(entries);
    expect((await getBodyMeasurements()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-01']);
  });
});
