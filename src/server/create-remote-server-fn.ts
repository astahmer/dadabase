import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import {
	RemoteConnectionId,
	makeRemoteConnectionLayer,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLoggerPersistentLayer } from "./query-logger/query-logger.layer.persisted";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { Effect, Layer, type ManagedRuntime } from "effect";

export const withRemoteConnectionLayers =
	<TOutput, E, R>(connectionUrl: string, connectionId: string) =>
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
