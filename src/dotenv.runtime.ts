import { NodeFileSystem } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer, ManagedRuntime, References } from "effect";
import path from "node:path";

const envFilePath = path.resolve(process.env.DADABASE_ENV_FILE ?? path.join(process.cwd(), ".env"));

const OptionalDotEnvProvider = ConfigProvider.fromDotEnv({ path: envFilePath }).pipe(
  Effect.catchIf(
    (error) => error.reason._tag === "NotFound",
    () => Effect.succeed(ConfigProvider.fromUnknown({})),
  ),
);

/**
 * Effect 4: `@effect/platform` is gone. `ConfigProvider.fromDotEnv` lives in
 * core but requires the FileSystem service; `layerAdd` merges it beneath the
 * ambient env provider (same "add" semantics as v3 `layerDotEnvAdd`).
 */
export const DotEnvProvider = ConfigProvider.layerAdd(OptionalDotEnvProvider).pipe(
  Layer.provideMerge(NodeFileSystem.layer),
);

/**
 * Effect 4: `Logger.pretty` / `Logger.minimumLogLevel` were removed — the
 * default logger already pretty-prints to console; log filtering is done via
 * the `References.MinimumLogLevel` context reference.
 */
export const DotenvRuntime = ManagedRuntime.make(
  DotEnvProvider.pipe(Layer.provide(Layer.succeed(References.MinimumLogLevel, "All"))),
);
