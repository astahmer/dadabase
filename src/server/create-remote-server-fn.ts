import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";
import type { DatabaseDialect } from "#src/db/dialect.ts";
import type { SqlClient } from "@effect/sql";
import type { SqlError } from "@effect/sql/SqlError";
import type { Selectable } from "kysely";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { makeRemoteSqlClientLayer } from "#src/db/postgres/remote-sql-client.layer.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import {
  makeRemoteConnectionLayer,
  type RemoteConnection,
  RemoteConnectionId,
  type RemoteConnectionIdType,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { Effect, Layer, type ManagedRuntime } from "effect";

import type { QueryLogger } from "./query-logger/query-logger.ts";

import { QueryLoggerPersistentLayer } from "./query-logger/query-logger.layer.persisted";

const withRemoteConnectionLayers =
  <TOutput, E, R>(
    dialect: DatabaseDialect,
    connectionUrl: string,
    connectionId: RemoteConnectionIdType,
  ) =>
  (effect: Effect.Effect<TOutput, E, R | RemoteConnection | QueryLogger>) =>
    Effect.gen(function* () {
      const context =
        yield* Effect.context<ManagedRuntime.ManagedRuntime.Context<typeof AppRuntime>>();

      const connectionLayer = QueryLoggerPersistentLayer.pipe(
        Layer.provide(Layer.succeedContext(context)),
        Layer.provideMerge(makeRemoteConnectionLayer(RemoteConnectionId.make(connectionId))),
      );

      const sqlLayer = yield* makeRemoteSqlClientLayer(connectionUrl, dialect);
      const program = effect.pipe(Effect.provide(connectionLayer), Effect.provide(sqlLayer));

      return yield* program;
    });

export const withRemoteConnectionLayersFromUrl =
  <TOutput, E, R>(connectionUrl: string) =>
  (effect: Effect.Effect<TOutput, E, R | RemoteConnection | QueryLogger>) =>
    Effect.gen(function* () {
      const context =
        yield* Effect.context<ManagedRuntime.ManagedRuntime.Context<typeof AppRuntime>>();

      const repo = yield* DatabaseConnectionRepository;
      const connection = yield* repo.findByUrl(connectionUrl);

      if (!connection) {
        return yield* Effect.fail(new Error(`Connection not found for URL: ${connectionUrl}`));
      }

      const connectionLayer = QueryLoggerPersistentLayer.pipe(
        Layer.provide(Layer.succeedContext(context)),
        Layer.provideMerge(makeRemoteConnectionLayer(RemoteConnectionId.make(connection.id))),
      );

      const sqlLayer = yield* makeRemoteSqlClientLayer(connectionUrl, connection.dialect);
      const program = effect.pipe(Effect.provide(connectionLayer), Effect.provide(sqlLayer));

      return yield* program;
    });

/**
 * Create a handler for introspection server functions that manages connection lookup and Effect runtime
 * @param effectFn - Function that takes input data and returns an Effect
 * @returns Async handler that manages connection resolution and runtime execution
 */
export const createRemoteIntrospectionHandler =
  <TInput extends { url: string }, TOutput>(
    effectFn: (
      input: TInput,
      connection: Selectable<AppDatabaseSchema["database_connections"]>,
    ) => Effect.Effect<TOutput, SqlError, SqlClient.SqlClient | QueryLogger | RemoteConnection>,
  ) =>
  async (ctx: { data: TInput }): Promise<TOutput> => {
    const program = Effect.gen(function* () {
      const repo = yield* DatabaseConnectionRepository;
      const connection = yield* repo.findByUrl(ctx.data.url);

      if (!connection) {
        return yield* Effect.fail(new Error(`Connection not found for URL: ${ctx.data.url}`));
      }

      return yield* effectFn(ctx.data, connection).pipe(
        withRemoteConnectionLayers(
          connection.dialect,
          connection.url,
          RemoteConnectionId.make(connection.id),
        ),
      );
    });
    try {
      return await AppRuntime.runPromise(program);
    } catch (error) {
      // Re-throw a plain Error so clients receive the driver message
      // (FiberFailure/SqlError wrappers serialize poorly over the wire).
      throw new Error(getErrorMessage(error));
    }
  };
