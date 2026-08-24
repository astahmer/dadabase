import type * as SqlConnection from "effect/unstable/sql/SqlConnection";

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, Result, Semaphore, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as Client from "effect/unstable/sql/SqlClient";

import { SqlError } from "#src/db/effect-compat.ts";

/**
 * DuckDB client for @effect/sql (v4).
 *
 * There is no official `@effect/sql` driver for DuckDB, so this module builds one
 * from the public SPI: a duckdb-backed `SqlConnection` plus the PostgreSQL
 * statement compiler (`PgClient.makeCompiler`, dialect `"pg"`).
 *
 * Reusing the pg compiler means every existing `sql.onDialectOrElse({ pg: ... })`
 * branch in introspection / row-mutation code is selected automatically — DuckDB's
 * SQL dialect is Postgres-flavored enough for those queries. Divergent behavior
 * (system row identity, constraints metadata, EXPLAIN shape) is handled at call
 * sites by checking the connection record's dialect instead of adding a compiler
 * dialect, because `Statement.onDialectOrElse` only knows sqlite/pg/mysql/mssql/
 * clickhouse.
 *
 * The compiled SQL uses `$1..$n` placeholders; DuckDB prepared statements accept
 * numbered parameters natively (verified in duckdb-client.test.ts), so no
 * placeholder rewriting happens here. See plans/csv-database-and-duckdb.md §0
 * for the measured SqlClient surface list this client must support.
 */

export interface DuckDbClientConfig {
  /** Absolute path to a `.duckdb` file, or `:memory:` for a scratch database. */
  readonly url: string;
}

const toSqlError = (cause: unknown, message: string) =>
  new SqlError({
    cause,
    ...(cause instanceof Error && cause.message ? { message: `${message}: ${cause.message}` } : {}),
  });

/** Serializes all queries: an embedded DuckDB allows one writer per process. */
const querySemaphore = Semaphore.makeUnsafe(1);

const readRows = (result: Awaited<ReturnType<DuckDBConnection["run"]>>) =>
  Effect.tryPromise({
    try: async () => await result.getRowObjectsJS(),
    catch: (cause) => toSqlError(cause, "DuckDbClient: failed to read result rows"),
  });

const runQuery = (connection: DuckDBConnection) =>
  Effect.fnUntraced(function* (sql: string, params: ReadonlyArray<unknown>) {
    return yield* Effect.tryPromise({
      try: () => connection.run(sql, params as never[]),
      catch: (cause) => toSqlError(cause, "DuckDbClient: query failed"),
    });
  });

const makeSqlConnection = (connection: DuckDBConnection): SqlConnection.Connection => {
  const run = runQuery(connection);

  type TransformRows = (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined;
  const applyTransform = (
    rows: ReadonlyArray<Record<string, unknown>>,
    transformRows: TransformRows,
  ): ReadonlyArray<Record<string, unknown>> =>
    transformRows
      ? rows.map((row) => transformRows([row as never])[0] as Record<string, unknown>)
      : rows;

  return {
    execute: (sql, params, transformRows) =>
      Effect.flatMap(run(sql, params), (result) =>
        Effect.map(readRows(result), (rows) => applyTransform(rows, transformRows)),
      ),

    // Shape mirrors pg's QueryResult so `extractRowsAffected` keeps working.
    executeRaw: (sql, params) =>
      Effect.flatMap(run(sql, params), (result) =>
        Effect.map(readRows(result), (rows) => ({ rowCount: result.rowCount, rows })),
      ),

    executeValues: (sql, params) =>
      Effect.flatMap(run(sql, params), (result) =>
        Effect.tryPromise({
          try: async () => await result.getRowsJS(),
          catch: (cause) => toSqlError(cause, "DuckDbClient: failed to read result rows"),
        }),
      ),

    executeValuesUnprepared: (sql, params) =>
      Effect.flatMap(run(sql, params), (result) =>
        Effect.tryPromise({
          try: async () => await result.getRowsJS(),
          catch: (cause) => toSqlError(cause, "DuckDbClient: failed to read result rows"),
        }),
      ),

    executeUnprepared: (sql, params, transformRows) =>
      Effect.flatMap(run(sql, params), (result) =>
        Effect.map(readRows(result), (rows) => applyTransform(rows, transformRows)),
      ),

    executeStream: (sql, params, transformRows) => {
      const stream: Stream.Stream<Record<string, unknown>, SqlError> = Stream.fromIterableEffect(
        Effect.flatMap(run(sql, params), (result) =>
          Effect.tryPromise({
            try: async () => await result.getRowObjectsJS(),
            catch: (cause) => toSqlError(cause, "DuckDbClient: failed to read result rows"),
          }),
        ),
      );
      const mapped: Stream.Stream<Record<string, unknown>, SqlError> = transformRows
        ? Stream.map(stream, (row) => applyTransform([row], transformRows)[0])
        : stream;
      return mapped as unknown as Stream.Stream<any, SqlError>;
    },
  };
};

/**
 * Instances are cached by resolved URL so repeated connections to the same file
 * reuse the open database handle (driver-level counterpart of PoolCache).
 * Instances live for the process lifetime; DuckDB flushes WAL on clean close of
 * its connections, which the scoped layer guarantees below.
 */
const instanceCache = new Map<string, DuckDBInstance>();

const getOrCreateInstance = (url: string): Effect.Effect<DuckDBInstance, SqlError> =>
  Effect.suspend(() => {
    const cached = instanceCache.get(url);
    if (cached) return Effect.succeed(cached);
    return Effect.tryPromise({
      try: async () => {
        const instance = await DuckDBInstance.create(url);
        instanceCache.set(url, instance);
        return instance;
      },
      catch: (cause) => toSqlError(cause, `DuckDbClient: failed to open database '${url}'`),
    });
  });

const extractFailureMessage = (failure: { readonly cause?: unknown }): string => {
  const cause = failure.cause;
  if (
    cause &&
    typeof cause === "object" &&
    "message" in cause &&
    typeof cause.message === "string"
  ) {
    return cause.message;
  }
  if (failure instanceof Error && failure.message) return failure.message;
  return "Unknown connection error";
};

/**
 * Probe a DuckDB database path without registering a client layer.
 * Mirrors the `{ success, message }` shape of the other test-* connection probes.
 */
export const probeDuckDbPath = (
  url: string,
): Effect.Effect<{ success: true; message: string } | { success: false; message: string }> =>
  Effect.gen(function* () {
    const instance = yield* getOrCreateInstance(url).pipe(Effect.result);
    if (Result.isFailure(instance)) {
      return { success: false, message: extractFailureMessage(instance.failure) } as const;
    }

    const connection = yield* Effect.tryPromise({
      try: () => instance.success.connect(),
      catch: (cause) => toSqlError(cause, "DuckDbClient: failed to open connection"),
    }).pipe(Effect.result);
    if (Result.isFailure(connection)) {
      return { success: false, message: extractFailureMessage(connection.failure) } as const;
    }
    const openConnection = connection.success;

    const probe = yield* Effect.tryPromise({
      try: async () => {
        await openConnection.run("SELECT 1");
        return true;
      },
      catch: (cause) => toSqlError(cause, "DuckDbClient: probe query failed"),
    }).pipe(Effect.result);

    openConnection.closeSync();

    if (Result.isSuccess(probe)) {
      return { success: true, message: "OK" } as const;
    }
    return { success: false, message: extractFailureMessage(probe.failure) } as const;
  });

export interface MakeDuckDbClientOptions {
  readonly url: string;
}

/**
 * Builds a `SqlClient.SqlClient` over DuckDB. Scoped: the underlying duckdb
 * connection is closed when the layer's scope ends.
 */
export const makeDuckDbClient = Effect.fnUntraced(function* (options: MakeDuckDbClientOptions) {
  const instance = yield* getOrCreateInstance(options.url);
  const connection = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => instance.connect(),
      catch: (cause) => toSqlError(cause, "DuckDbClient: failed to open connection"),
    }),
    (conn) =>
      Effect.sync(() => {
        try {
          conn.closeSync();
        } catch {
          // already closed
        }
      }),
  );

  const sql = makeSqlConnection(connection);
  const acquirer = querySemaphore.withPermit(Effect.succeed(sql));

  return yield* Client.make({
    acquirer,
    transactionAcquirer: acquirer,
    compiler: PgClient.makeCompiler(),
    spanAttributes: [
      ["db.system", "duckdb"],
      ["db.path", options.url],
    ],
  });
});

export const layer = (config: DuckDbClientConfig): Layer.Layer<Client.SqlClient, SqlError> =>
  makeDuckDbClient(config).pipe(Layer.effect(Client.SqlClient), Layer.provide(Reactivity.layer));
