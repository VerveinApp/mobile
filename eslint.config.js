// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions/** runs on Deno (Deno.serve, npm: import
    // specifiers, no React Native globals at all) — a completely separate
    // runtime/toolchain from the rest of this repo, so it must never be
    // swept into the app's own eslint pass.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
