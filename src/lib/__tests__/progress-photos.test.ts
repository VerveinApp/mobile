import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearProgressPhotos, deleteProgressPhoto, getProgressPhotos, type ProgressPhotoEntry } from '@/lib/progress-photos';

// No public setter exists for seeding metadata directly — addProgressPhoto
// itself needs a real source file to copy, which doesn't exist under the
// jest-expo file-system mock (it resolves to null in that environment, same
// as a real permission/disk failure would on-device). Writing straight to
// the same AsyncStorage key mirrors what session-history.test.ts already
// does for keys with no public setter (see its own ACCOUNT_START_DATE_KEY).
const KEY = 'vervein.progressPhotos.v1';

async function seed(entries: ProgressPhotoEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

describe('progress-photos', () => {
  afterEach(async () => {
    await clearProgressPhotos();
  });

  it('returns an empty list when nothing has been added', async () => {
    expect(await getProgressPhotos()).toEqual([]);
  });

  it('getProgressPhotos sorts most-recent-date-first, then most-recently-created within the same date', async () => {
    await seed([
      { id: 'a', date: '2026-06-01', fileName: 'a.jpg', createdAt: '2026-06-01T08:00:00.000Z' },
      { id: 'b', date: '2026-06-03', fileName: 'b.jpg', createdAt: '2026-06-03T08:00:00.000Z' },
      { id: 'c', date: '2026-06-01', fileName: 'c.jpg', createdAt: '2026-06-01T09:00:00.000Z' },
    ]);
    expect((await getProgressPhotos()).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('deleteProgressPhoto removes only the targeted entry\'s metadata', async () => {
    await seed([
      { id: 'a', date: '2026-06-01', fileName: 'a.jpg', createdAt: '2026-06-01T08:00:00.000Z' },
      { id: 'b', date: '2026-06-02', fileName: 'b.jpg', createdAt: '2026-06-02T08:00:00.000Z' },
    ]);
    await deleteProgressPhoto('a');
    const remaining = await getProgressPhotos();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('b');
  });

  it('deleteProgressPhoto on an id that was never added is a safe no-op', async () => {
    await seed([{ id: 'a', date: '2026-06-01', fileName: 'a.jpg', createdAt: '2026-06-01T08:00:00.000Z' }]);
    await expect(deleteProgressPhoto('missing')).resolves.toBeUndefined();
    expect(await getProgressPhotos()).toHaveLength(1);
  });

  it('clearProgressPhotos wipes every entry\'s metadata', async () => {
    await seed([{ id: 'a', date: '2026-06-01', fileName: 'a.jpg', createdAt: '2026-06-01T08:00:00.000Z' }]);
    await clearProgressPhotos();
    expect(await getProgressPhotos()).toEqual([]);
  });
});
