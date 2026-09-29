// The official AsyncStorage jest mock only exports a mock object — it
// doesn't register itself. This actually wires it up as the module jest
// resolves whenever any source file imports @react-native-async-storage/
// async-storage, per that package's own documented jest integration.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-secure-store ships no jest mock of its own (unlike AsyncStorage
// above) and neither does jest-expo — without this, the auto-mocked native
// module's setItemAsync/getItemAsync are no-ops with no real backing store,
// so secure-session-storage.ts's tests would see every write silently
// vanish. A plain in-memory Map is enough; nothing here needs real
// encryption or persistence across test runs.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});
