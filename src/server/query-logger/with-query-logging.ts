import { Effect } from "effect";
import { QueryLogger } from "./query-logger.service.ts";
import type { QueryLogEntryType, QueryLogType } from "./query-logger.types.ts";

export interface WithQueryLoggingOptions {
	type: QueryLogType;
	sql?: string;
	schema?: string;
	table?: string;
	params?: Record<string, any> | ReadonlyArray<any>;
	/**
	 * Connection ID for database persistence.
	 * Logs will be automatically persisted to the database.
	 */
	connectionId: string;
	persistFn: (
		connectionId: string,
		entry: QueryLogEntryType,
	) => Effect.Effect<void, any, any>;
	updatePersistFn: (
		id: string,
		updates: Partial<QueryLogEntryType>,
	) => Effect.Effect<void, any, any>;
}

/**
 * Wraps an Effect with automatic query logging and database persistence
 * Logs the query execution with timing, status, and any errors
 *
 * @example
 * const result = yield* withQueryLogging(
 *   queryEffect,
 *   {
 *     type: "table",
 *     sql: compiledSql,
 *     schema: "public",
 *     table: "users",
 *     connectionId: connection.id,
 *     persistFn: persistQueryLog,
 *     updatePersistFn: updatePersistedQueryLog
 *   }
 * );
 */
export const withQueryLogging = <R, E, A>(
	effect: Effect.Effect<A, E, R>,
	options: WithQueryLoggingOptions,
): Effect.Effect<A, E, R | QueryLogger> => {
	return Effect.gen(function* () {
		const logger = yield* QueryLogger;
		const startTime = Date.now();
		const logEntry: Omit<QueryLogEntryType, "id"> = {
			sql: options.sql || "",
			params: options.params,
			type: options.type,
			schema: options.schema,
			table: options.table,
			status: "pending",
			startTime,
		};

		const entryId = yield* logger.addEntry(logEntry);

		// Persist initial entry
		yield* options
			.persistFn(options.connectionId, { ...logEntry, id: entryId })
			.pipe(
				Effect.catchAll(() =>
					Effect.sync(() =>
						console.warn(`Failed to persist initial query log ${entryId}`),
					),
				),
			);

		return yield* effect.pipe(
			Effect.tap(() => {
				const endTime = Date.now();
				const updates = {
					status: "success" as const,
					endTime,
					timeTaken: endTime - startTime,
				};
				return logger.updateEntry(entryId, updates).pipe(
					Effect.andThen(() => options.updatePersistFn(entryId, updates)),
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist query log update for ${entryId}`),
						),
					),
				);
			}),
			Effect.catchAll((error) => {
				const endTime = Date.now();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;
				const updates = {
					status: "error" as const,
					endTime,
					timeTaken: endTime - startTime,
					error: {
						message: errorMessage,
						stack: errorStack,
					},
				};

				return logger.updateEntry(entryId, updates).pipe(
					Effect.andThen(() => options.updatePersistFn(entryId, updates)),
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist error for query log ${entryId}`),
						),
					),
					Effect.andThen(() => Effect.fail(error as E)),
				);
			}),
		);
	});
};

/**
 * Wraps an Effect with automatic query logging and database persistence
 * For results that include row counts
 *
 * @example
 * const result = yield* withQueryLoggingAndRowCount(
 *   db.execute(query),
 *   {
 *     type: "table",
 *     sql: query.compile().sql,
 *     schema: "public",
 *     table: "users",
 *     connectionId: connection.id,
 *     persistFn: persistQueryLog,
 *     updatePersistFn: updatePersistedQueryLog
 *   }
 * );
 */
export const withQueryLoggingAndRowCount = <
	R,
	E,
	A extends { rows?: any[]; rowCount?: number },
>(
	effect: Effect.Effect<A, E, R>,
	options: WithQueryLoggingOptions,
): Effect.Effect<A, E, R | QueryLogger> => {
	return Effect.gen(function* () {
		const logger = yield* QueryLogger;
		const startTime = Date.now();
		const logEntry: Omit<QueryLogEntryType, "id"> = {
			sql: options.sql || "",
			params: options.params,
			type: options.type,
			schema: options.schema,
			table: options.table,
			status: "pending",
			startTime,
		};

		const entryId = yield* logger.addEntry(logEntry);

		// Persist initial entry
		yield* options
			.persistFn(options.connectionId, { ...logEntry, id: entryId })
			.pipe(
				Effect.catchAll(() =>
					Effect.sync(() =>
						console.warn(`Failed to persist initial query log ${entryId}`),
					),
				),
			);

		return yield* effect.pipe(
			Effect.tap((result) => {
				const endTime = Date.now();
				const updates = {
					status: "success" as const,
					endTime,
					timeTaken: endTime - startTime,
					rowsReturned: result.rows?.length ?? 0,
					rowsAffected: result.rowCount,
				};
				return logger.updateEntry(entryId, updates).pipe(
					Effect.andThen(() => options.updatePersistFn(entryId, updates)),
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist query log update for ${entryId}`),
						),
					),
				);
			}),
			Effect.catchAll((error) => {
				const endTime = Date.now();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;
				const updates = {
					status: "error" as const,
					endTime,
					timeTaken: endTime - startTime,
					error: {
						message: errorMessage,
						stack: errorStack,
					},
				};

				return logger.updateEntry(entryId, updates).pipe(
					Effect.andThen(() => options.updatePersistFn(entryId, updates)),
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist error for query log ${entryId}`),
						),
					),
					Effect.andThen(() => Effect.fail(error as E)),
				);
			}),
		);
	});
};
