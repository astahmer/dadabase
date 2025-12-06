import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import jsxSource from "unplugin-jsx-source/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const defaultTransformFileName = (
	id: string,
	loc: {
		start: { line: number; column: number };
		end: { line: number; column: number };
	},
) => {
	const fileName = id.split("/").slice(-2).join("/") ?? "unknown";
	return `${fileName}:${loc.start.line}`;
};

const config = defineConfig((env) => ({
	resolve: {
		alias: {
			"@dadabase/effect-pglite": "/packages/effect-pglite/src/mod.ts",
		},
	},
	plugins: [
		// devtools({
		// 	injectSource: { enabled: false },
		// 	enhancedLogs: { enabled: false },
		// 	logging: false,
		// 	eventBusConfig: { enabled: false },
		// }),
		env.mode === "development" &&
			jsxSource({
				enforce: "pre",
				transformFileName: (fileName, loc) =>
					defaultTransformFileName(fileName, loc),
			}),
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart({ spa: { enabled: false } }),
		viteReact(),
	],
}));

export default config;
