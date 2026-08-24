import type { StartedMSSQLServerContainer } from "@testcontainers/mssqlserver";

import { MSSQLServerContainer } from "@testcontainers/mssqlserver";
import { Context, Effect, Layer } from "effect";

import { ContainerError, isContainerRuntimeAvailable } from "./pg-test.layer.ts";

/**
 * Real SQL Server container for introspection e2e tests — the MSSQL twin of
 * `pg-test.layer.ts`. Reuses the app's own `layerFromUrl` so the test exercises
 * the exact same client construction path as production.
 *
 * NOTE: SQL Server publishes no arm64 images; on Apple Silicon this runs under
 * Docker Desktop's amd64 emulation (Rosetta). Tests are skipped when no
 * container runtime answers.
 */

const SA_PASSWORD = "Dadabase!1234"; // must satisfy SQL Server complexity policy

export class MssqlContainer extends Context.Service<
  MssqlContainer,
  StartedMSSQLServerContainer
>()("test/MssqlContainer") {
  static readonly Default = Layer.effect(
    MssqlContainer,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          new MSSQLServerContainer("mcr.microsoft.com/mssql/server:2022-latest")
            .acceptLicense()
            .withPassword(SA_PASSWORD)
            .start(),
        catch: (cause) => new ContainerError({ cause }),
      }),
      (container) => Effect.promise(() => container.stop()),
    ),
  );

  /** App-shaped SqlClient layer built through `layerFromUrl` (production path). */
  static ClientLive = Layer.unwrap(
    Effect.gen(function* () {
      const container = yield* MssqlContainer;
      const url =
        `mssql://sa:${encodeURIComponent(SA_PASSWORD)}` +
        `@${container.getHost()}:${container.getMappedPort(1433)}/master?sslmode=require`;
      const mssqlClient = yield* Effect.promise(
        () => import("../db-connection/mssql/mssql-client.ts"),
      );
      return mssqlClient.layerFromUrl(url);
    }),
  ).pipe(Layer.provide(this.Default));
}

export { isContainerRuntimeAvailable };
