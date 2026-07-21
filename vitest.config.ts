import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dadabase/effect-pglite": "/packages/effect-pglite/src/mod.ts",
    },
  },
  test: {
    hideSkippedTests: true,
    passWithNoTests: true,
    // PGlite 0.5 + Effect layers are slower under parallel load than the 5s default.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    exclude: [...defaultExclude, ".context", ".references/**", "e2e/**"],
  },
});
