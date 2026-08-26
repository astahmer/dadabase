import tailwindcss from "@tailwindcss/vite";
// import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import jsxSource from "unplugin-jsx-source/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

import { VITE_SERVER_WATCH_IGNORED } from "./src/lib/vite-dev-watch.ts";

const cpuFeaturesStub = fileURLToPath(new URL("./vite-stubs/cpu-features.cjs", import.meta.url));

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
      // ssh2 optionally requires native cpu-features (.node). Rolldown resolves it
      // statically despite try/catch — stub so client dep optimize can finish.
      "cpu-features": cpuFeaturesStub,
    },
  },
  optimizeDeps: {
    // ssh2 is loaded only by the server when an SSH tunnel is configured. Its optional
    // native binding cannot be scanned by the browser dependency optimizer.
    exclude: ["ssh2", "@duckdb/node-api", "@duckdb/node-bindings"],
  },
  server: {
    // Project-local `.references/` clones + docs must not enter the watch graph.
    // Without this, editing `prompts.local.md` (or anything under `.references`)
    // hard-reloads the app and Tailwind CSS rebuilds can take tens of seconds.
    watch: {
      ignored: [...VITE_SERVER_WATCH_IGNORED],
    },
    fs: {
      deny: [".references"],
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
        transformFileName: (fileName, loc) => defaultTransformFileName(fileName, loc),
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
