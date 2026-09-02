// Only needed for jest-expo's babel-jest transform — Metro (the app's real
// bundler) resolves its own Expo/Reanimated babel config internally and
// never reads this file. Kept minimal on purpose: this project has no other
// babel-dependent tooling.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
