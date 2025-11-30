import { AppDatabase } from "#src/db/app.db.ts";
import { Effect, Layer } from "effect";
import { RemoteConnection } from "../db-connection/remote-connection.tag.ts";
import { NanoId } from "../services/nano-id.ts";
import {
	deleteQueryLog,
	getQueryLogs,
	persistQueryLog,
	updatePersistedQueryLog,
} from "./query-logger.kysely.ts";
import { QueryLogger } from "./query-logger.ts";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export const QueryLoggerPersistentLayer = Layer.effect(
	QueryLogger,
	Effect.gen(function* () {
		const connectionId = yield* RemoteConnection;
		const appDatabase = yield* AppDatabase;
		const nanoId = yield* NanoId;

		return QueryLogger.of({
			get: Effect.gen(function* () {
				return yield* getQueryLogs(connectionId, 100).pipe(
					Effect.tapError((err) =>
						Effect.logWarning("Failed to fetch query logs from database", err),
					),
					Effect.orElseSucceed(() => []),
				);
			}).pipe(Effect.provideService(AppDatabase, appDatabase)),
			push: function (
				entry: Omit<QueryLogEntryType, "id">,
			): Effect.Effect<string, never, never> {
				return Effect.gen(function* () {
					const entryId = yield* nanoId.generate("ql");
					yield* persistQueryLog(connectionId, { ...entry, id: entryId }).pipe(
						Effect.tapError((err) =>
							Effect.logWarning("Failed to insert query log to database", err),
						),
						Effect.orElseSucceed(() => Effect.void),
					);
					return entryId;
				}).pipe(Effect.provideService(AppDatabase, appDatabase));
			},
			update: function (
				entryId: string,
				updates: Partial<QueryLogEntryType>,
			): Effect.Effect<void, never, never> {
				return updatePersistedQueryLog(entryId, updates)
					.pipe(
						Effect.tapError((err) =>
							Effect.logWarning("Failed to update query log to database", err),
						),
						Effect.orElseSucceed(() => Effect.void),
					)
					.pipe(Effect.provideService(AppDatabase, appDatabase));
			},
			clearAll: function (): Effect.Effect<void, never, never> {
				return appDatabase.execute(appDatabase.deleteFrom("query_logs")).pipe(
					Effect.tapError((err) =>
						Effect.logWarning("Failed to clear all query log in database", err),
					),
					Effect.orElseSucceed(() => Effect.void),
					Effect.provideService(AppDatabase, appDatabase),
				);
			},
			remove: function (id: string): Effect.Effect<void, never, never> {
				return deleteQueryLog(id).pipe(
					Effect.tapError((err) =>
						Effect.logWarning("Failed to remove query log from database", err),
					),
					Effect.orElseSucceed(() => Effect.void),
					Effect.provideService(AppDatabase, appDatabase),
				);
			},
		});
	}),
);
