import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import {
	RemoteConnectionId,
	makeRemoteConnectionLayer,
	type RemoteConnectionIdType,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { Effect, Layer, type ManagedRuntime } from "effect";
import { QueryLoggerPersistentLayer } from "./query-logger/query-logger.layer.persisted";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

export const withRemoteConnectionLayers =
	<TOutput, E, R>(
		connectionUrl: string,
		connectionId: RemoteConnectionIdType,
	) =>
	(effect: Effect.Effect<TOutput, E, R>) =>
		Effect.gen(function* () {
			const context =
				yield* Effect.context<
					ManagedRuntime.ManagedRuntime.Context<typeof AppRuntime>
				>();

			const connectionLayer = QueryLoggerPersistentLayer.pipe(
				Layer.provide(Layer.succeedContext(context)),
				Layer.provideMerge(
					makeRemoteConnectionLayer(RemoteConnectionId.make(connectionId)),
				),
			);

			const program = effect.pipe(
				Effect.provide(connectionLayer),
				Effect.provide(makeKyselyPgDatabaseLayer(connectionUrl)),
			);

			return yield* program;
		});

export const withRemoteConnectionLayersFromUrl =
	<TOutput, E, R>(connectionUrl: string) =>
	(effect: Effect.Effect<TOutput, E, R>) =>
		Effect.gen(function* () {
			const context =
				yield* Effect.context<
					ManagedRuntime.ManagedRuntime.Context<typeof AppRuntime>
				>();

			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(connectionUrl);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${connectionUrl}`),
				);
			}

			const connectionLayer = QueryLoggerPersistentLayer.pipe(
				Layer.provide(Layer.succeedContext(context)),
				Layer.provideMerge(
					makeRemoteConnectionLayer(RemoteConnectionId.make(connection.id)),
				),
			);

			const program = effect.pipe(
				Effect.provide(connectionLayer),
				Effect.provide(makeKyselyPgDatabaseLayer(connectionUrl)),
			);

			return yield* program;
		});
