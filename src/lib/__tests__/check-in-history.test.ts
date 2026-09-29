import { clearCheckInHistory, getLastCheckIn, recordCheckIn, restoreLastCheckIn } from '@/lib/check-in-history';

describe('check-in-history', () => {
  afterEach(async () => {
    await clearCheckInHistory();
  });

  it('returns null when nothing has ever been recorded', async () => {
    expect(await getLastCheckIn()).toBeNull();
  });

  it('recordCheckIn then getLastCheckIn round-trips the real energy and today\'s date', async () => {
    await recordCheckIn(4);
    const record = await getLastCheckIn();
    expect(record?.energy).toBe(4);
    expect(typeof record?.date).toBe('string');
  });

  it('a second recordCheckIn overwrites the previous one — only the single most recent is kept', async () => {
    await recordCheckIn(2);
    await recordCheckIn(5);
    expect((await getLastCheckIn())?.energy).toBe(5);
  });

  it('clearCheckInHistory wipes the stored record', async () => {
    await recordCheckIn(3);
    await clearCheckInHistory();
    expect(await getLastCheckIn()).toBeNull();
  });

  it('restoreLastCheckIn overwrites the stored record wholesale, preserving its own date rather than re-stamping today', async () => {
    await restoreLastCheckIn({ date: '2020-01-01', energy: 1 });
    expect(await getLastCheckIn()).toEqual({ date: '2020-01-01', energy: 1 });
  });

  it('restoreLastCheckIn(null) clears the record', async () => {
    await recordCheckIn(3);
    await restoreLastCheckIn(null);
    expect(await getLastCheckIn()).toBeNull();
  });
});
