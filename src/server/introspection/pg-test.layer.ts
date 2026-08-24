import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { PgClient } from "@effect/sql-pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Context, Data, Effect, Layer, Redacted, String } from "effect";
import { execFileSync } from "node:child_process";

export class ContainerError extends Data.TaggedError("ContainerError")<{
  cause: unknown;
}> {}

/** True when a Docker-compatible runtime answers `docker info` (needed by testcontainers). */
export function isContainerRuntimeAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], {
      stdio: "ignore",
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

export class PgContainer extends Context.Service<PgContainer, StartedPostgreSqlContainer>()(
  "test/PgContainer",
) {
  static readonly Default = Layer.effect(
    PgContainer,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: () => new PostgreSqlContainer("postgres:alpine").start(),
        catch: (cause) => new ContainerError({ cause }),
      }),
      (container) => Effect.promise(() => container.stop()),
    ),
  );

  static ClientLive = Layer.unwrap(
    Effect.gen(function* () {
      const container = yield* PgContainer;
      return PgClient.layer({
        url: Redacted.make(container.getConnectionUri()),
      });
    }),
  ).pipe(Layer.provide(this.Default));

  static ClientTransformLive = Layer.unwrap(
    Effect.gen(function* () {
      const container = yield* PgContainer;
      return PgClient.layer({
        url: Redacted.make(container.getConnectionUri()),
        transformResultNames: String.snakeToCamel,
        transformQueryNames: String.camelToSnake,
      });
    }),
  ).pipe(Layer.provide(this.Default));
}
