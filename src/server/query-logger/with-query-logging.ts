import { Effect } from "effect";
import { QueryLogger } from "./query-logger.service.ts";
import type { QueryLogEntryType, QueryLogType } from "./query-logger.types.ts";

const trimSql = (sql: string) =>
	sql
		.split("\n")
		.filter((str) => !str.startsWith("--"))
		.join(" ")
		.trim();
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
	connectionId?: string | undefined;
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
 * Usage with pipe:
 * @example
 * const result = yield* db.execute(query).pipe(
 *   withQueryLogging({
 *     type: "table",
 *     sql: compiledSql,
 *     schema: "public",
 *     table: "users",
 *     connectionId: connection.id,
 *     persistFn: persistQueryLog,
 *     updatePersistFn: updatePersistedQueryLog
 *   })
 * );
 */
export const withQueryLogging =
	<TOutput, E, R>(options: WithQueryLoggingOptions) =>
	(
		effect: Effect.Effect<TOutput, E, R>,
	): Effect.Effect<TOutput, E, R | QueryLogger> => {
		const connectionId = options.connectionId;
		if (!connectionId) return effect;

		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			const startTime = Date.now();
			const logEntry: Omit<QueryLogEntryType, "id"> = {
				sql: trimSql(options.sql || ""),
				params: options.params,
				type: options.type,
				schema: options.schema,
				table: options.table,
				status: "pending",
				startTime,
			};

			const entryId = yield* queryLogger.addEntry(logEntry);

			// Persist initial entry
			yield* options
				.persistFn(connectionId, { ...logEntry, id: entryId })
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
					const updates: Partial<QueryLogEntryType> = {
						status: "success" as const,
						endTime,
						timeTaken: endTime - startTime,
					};
					if (
						result &&
						typeof result === "object" &&
						"rows" in result &&
						Array.isArray(result.rows)
					) {
						updates.rowsReturned = result.rows.length;
					}
					if (result && typeof result === "object" && "rowCount" in result) {
						updates.rowsAffected = result.rowCount as number;
					}

					return queryLogger.updateEntry(entryId, updates).pipe(
						Effect.andThen(() => options.updatePersistFn(entryId, updates)),
						Effect.catchAll(() =>
							Effect.sync(() =>
								console.warn(
									`Failed to persist query log update for ${entryId}`,
								),
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

					return queryLogger.updateEntry(entryId, updates).pipe(
						Effect.andThen(() => options.updatePersistFn(entryId, updates)),
						Effect.catchAll(() =>
							Effect.sync(() =>
								console.warn(
									`Failed to persist error for query log ${entryId}`,
								),
							),
						),
						Effect.andThen(() => Effect.fail(error as E)),
					);
				}),
			);
		}) as Effect.Effect<TOutput, E, R | QueryLogger>;
	};
