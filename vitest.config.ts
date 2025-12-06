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
		exclude: [...defaultExclude, ".context"],
	},
});
