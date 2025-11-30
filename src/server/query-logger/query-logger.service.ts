import { AppDatabase } from "#src/db/app.db.ts";
import { Context, Effect, Layer, Ref } from "effect";
import { RemoteConnection } from "../db-connection/remote-connection.tag.ts";
import { NanoId } from "../services/nano-id.ts";
import {
	deleteQueryLog,
	getQueryLogs,
	persistQueryLog,
	updatePersistedQueryLog,
} from "./query-logger.kysely.ts";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export interface QueryLoggerInterface {
	get: Effect.Effect<QueryLogEntryType[], never, never>;
	push: (
		entry: Omit<QueryLogEntryType, "id">,
	) => Effect.Effect<string, never, never>;
	update: (
		id: string,
		updates: Partial<QueryLogEntryType>,
	) => Effect.Effect<void, never, never>;
	clearAll: () => Effect.Effect<void, never, never>;
	remove: (id: string) => Effect.Effect<void, never, never>;
}

export class QueryLogger extends Context.Tag("@dadabase/QueryLogger")<
	QueryLogger,
	QueryLoggerInterface
>() {}

export const QueryLoggerNoopLayer = Layer.succeed(
	QueryLogger,
	QueryLogger.of({
		get: Effect.succeed([]),
		push: () => Effect.succeed("xxx"),
		update: () => Effect.void,
		clearAll: () => Effect.void,
		remove: () => Effect.void,
	}),
);

export const QueryLoggerInMemoryLayer = Layer.effect(
	QueryLogger,
	Effect.gen(function* () {
		const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

		return {
			get: Ref.get(entriesRef),
			push: (entry: Omit<QueryLogEntryType, "id">) =>
				Effect.gen(function* () {
					const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
					const fullEntry = { ...entry, id };

					yield* Ref.update(entriesRef, (entries) => entries.concat(fullEntry));

					return id;
				}),
			update: (id: string, updates: Partial<QueryLogEntryType>) =>
				Effect.gen(function* () {
					yield* Ref.update(entriesRef, (entries) =>
						entries.map((entry) =>
							entry.id === id ? { ...entry, ...updates } : entry,
						),
					);
				}),
			clearAll: () =>
				Effect.gen(function* () {
					yield* Ref.set(entriesRef, []);
				}),
			remove: (id: string) =>
				Effect.gen(function* () {
					yield* Ref.update(entriesRef, (entries) =>
						entries.filter((entry) => entry.id !== id),
					);
				}),
		};
	}),
);

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
