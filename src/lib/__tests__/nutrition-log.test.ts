import {
  clearNutritionLog,
  deleteNutritionEntry,
  getNutritionLog,
  restoreNutritionLog,
  saveNutritionEntry,
  type NutritionLogEntry,
} from '@/lib/nutrition-log';

describe('nutrition-log', () => {
  afterEach(async () => {
    await clearNutritionLog();
  });

  it('returns an empty list when nothing has been logged', async () => {
    expect(await getNutritionLog()).toEqual([]);
  });

  it('saveNutritionEntry then getNutritionLog round-trips a real entry', async () => {
    await saveNutritionEntry('2026-06-01', 2200);
    expect(await getNutritionLog()).toEqual([{ date: '2026-06-01', calories: 2200 }]);
  });

  it('a second save for the same date overwrites rather than duplicating', async () => {
    await saveNutritionEntry('2026-06-01', 2200);
    await saveNutritionEntry('2026-06-01', 1800);
    const log = await getNutritionLog();
    expect(log).toHaveLength(1);
    expect(log[0].calories).toBe(1800);
  });

  it('getNutritionLog returns entries most-recent-first', async () => {
    await saveNutritionEntry('2026-06-01', 2000);
    await saveNutritionEntry('2026-06-03', 2100);
    await saveNutritionEntry('2026-06-02', 2050);
    expect((await getNutritionLog()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-02', '2026-06-01']);
  });

  it('deleteNutritionEntry removes only the targeted date', async () => {
    await saveNutritionEntry('2026-06-01', 2000);
    await saveNutritionEntry('2026-06-02', 2100);
    await deleteNutritionEntry('2026-06-01');
    expect((await getNutritionLog()).map((e) => e.date)).toEqual(['2026-06-02']);
  });

  it('clearNutritionLog wipes every entry', async () => {
    await saveNutritionEntry('2026-06-01', 2000);
    await clearNutritionLog();
    expect(await getNutritionLog()).toEqual([]);
  });

  it('restoreNutritionLog overwrites the whole log wholesale, sorted most-recent-first on read', async () => {
    const entries: NutritionLogEntry[] = [
      { date: '2026-06-01', calories: 2000 },
      { date: '2026-06-03', calories: 2200 },
    ];
    await restoreNutritionLog(entries);
    expect((await getNutritionLog()).map((e) => e.date)).toEqual(['2026-06-03', '2026-06-01']);
  });
});
