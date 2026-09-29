import { trimToNewestByDate } from '@/lib/rolling-window';

describe('trimToNewestByDate', () => {
  it('keeps the newest entries by date, not by the order they were written', () => {
    // A backfilled old date written last used to survive a trim while a
    // newer real entry written earlier got dropped.
    const entries = [
      { date: '2026-09-20', id: 'recent' },
      { date: '2026-09-21', id: 'newest' },
      { date: '2026-01-05', id: 'backfilled-late' },
    ];
    expect(trimToNewestByDate(entries, 2).map((e) => e.id)).toEqual(['recent', 'newest']);
  });

  it('returns everything, oldest first, when under the cap', () => {
    const entries = [{ date: '2026-09-02' }, { date: '2026-09-01' }];
    expect(trimToNewestByDate(entries, 10)).toEqual([{ date: '2026-09-01' }, { date: '2026-09-02' }]);
  });
});
