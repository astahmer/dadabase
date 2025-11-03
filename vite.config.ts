import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { devtools } from "@tanstack/devtools-vite";
import jsxSource from "unplugin-jsx-source/vite";

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
	plugins: [
		devtools({ injectSource: { enabled: false } }),
		env.mode === "development" &&
			jsxSource({
				enforce: "pre",
				transformFileName: (fileName, loc) =>
					defaultTransformFileName(fileName, loc),
			}),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
}));

export default config;
