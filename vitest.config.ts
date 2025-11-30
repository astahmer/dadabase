import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
	test: {
		hideSkippedTests: true,
		passWithNoTests: true,
		exclude: [...defaultExclude, ".context"],
	},
});
