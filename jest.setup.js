// The official AsyncStorage jest mock only exports a mock object — it
// doesn't register itself. This actually wires it up as the module jest
// resolves whenever any source file imports @react-native-async-storage/
// async-storage, per that package's own documented jest integration.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
