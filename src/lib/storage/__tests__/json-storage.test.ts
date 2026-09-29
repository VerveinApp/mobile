import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearStoredValue, readJsonList, readJsonValue, writeJsonValue } from '@/lib/storage/json-storage';

const KEY_A = 'test.jsonStorage.a';
const KEY_B = 'test.jsonStorage.b';

type Entry = { id: string; value: number };

describe('json-storage', () => {
  afterEach(async () => {
    await AsyncStorage.removeItem(KEY_A);
    await AsyncStorage.removeItem(KEY_B);
  });

  describe('readJsonValue/writeJsonValue (generic — Record-shaped values, not just lists)', () => {
    type Store = Record<string, Entry[]>;

    it('returns the given fallback for a key that was never written', async () => {
      expect(await readJsonValue<Store>(KEY_A, {})).toEqual({});
    });

    it('round-trips a real Record value', async () => {
      const value: Store = { squat: [{ id: 'a', value: 1 }] };
      await writeJsonValue(KEY_A, value);
      expect(await readJsonValue<Store>(KEY_A, {})).toEqual(value);
    });

    it('reads corrupt stored JSON as the given fallback, never throws', async () => {
      await AsyncStorage.setItem(KEY_A, 'not valid json{');
      await expect(readJsonValue<Store>(KEY_A, {})).resolves.toEqual({});
    });
  });

  describe('readJsonList (convenience wrapper — fallback is always [])', () => {
    it('returns an empty list for a key that was never written', async () => {
      expect(await readJsonList<Entry>(KEY_A)).toEqual([]);
    });

    it('round-trips a real array of entries', async () => {
      const entries: Entry[] = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
      await writeJsonValue(KEY_A, entries);
      expect(await readJsonList<Entry>(KEY_A)).toEqual(entries);
    });

    it('round-trips an empty array (distinct from "never written," but reads the same)', async () => {
      await writeJsonValue<Entry[]>(KEY_A, []);
      expect(await readJsonList<Entry>(KEY_A)).toEqual([]);
    });

    it('a write fully overwrites the previous value rather than merging', async () => {
      await writeJsonValue(KEY_A, [{ id: 'a', value: 1 }]);
      await writeJsonValue(KEY_A, [{ id: 'b', value: 2 }]);
      expect(await readJsonList<Entry>(KEY_A)).toEqual([{ id: 'b', value: 2 }]);
    });

    it('reads corrupt stored JSON as an honest empty list, never throws', async () => {
      await AsyncStorage.setItem(KEY_A, 'not valid json{');
      await expect(readJsonList<Entry>(KEY_A)).resolves.toEqual([]);
    });
  });

  describe('clearStoredValue', () => {
    it('removes the key so a subsequent read is empty again', async () => {
      await writeJsonValue(KEY_A, [{ id: 'a', value: 1 }]);
      await clearStoredValue(KEY_A);
      expect(await readJsonList<Entry>(KEY_A)).toEqual([]);
    });

    it('on a key that was never written is a safe no-op', async () => {
      await expect(clearStoredValue(KEY_A)).resolves.toBeUndefined();
    });
  });

  it('different keys never see each other\'s data', async () => {
    await writeJsonValue(KEY_A, [{ id: 'a', value: 1 }]);
    await writeJsonValue(KEY_B, [{ id: 'b', value: 2 }]);
    expect(await readJsonList<Entry>(KEY_A)).toEqual([{ id: 'a', value: 1 }]);
    expect(await readJsonList<Entry>(KEY_B)).toEqual([{ id: 'b', value: 2 }]);
  });
});
