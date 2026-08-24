import { NodeFileSystem } from "@effect/platform-node";
import { ConfigProvider, Layer, ManagedRuntime, References } from "effect";
import path from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;
const envFilePath = path.resolve(path.join(__dirname, "../.env"));

/**
 * Effect 4: `@effect/platform` is gone. `ConfigProvider.fromDotEnv` lives in
 * core but requires the FileSystem service; `layerAdd` merges it beneath the
 * ambient env provider (same "add" semantics as v3 `layerDotEnvAdd`).
 */
export const DotEnvProvider = ConfigProvider.layerAdd(
  ConfigProvider.fromDotEnv({ path: envFilePath }),
).pipe(Layer.provideMerge(NodeFileSystem.layer));

/**
 * Effect 4: `Logger.pretty` / `Logger.minimumLogLevel` were removed — the
 * default logger already pretty-prints to console; log filtering is done via
 * the `References.MinimumLogLevel` context reference.
 */
export const DotenvRuntime = ManagedRuntime.make(
  DotEnvProvider.pipe(Layer.provide(Layer.succeed(References.MinimumLogLevel, "All"))),
);
