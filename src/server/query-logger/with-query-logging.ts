import { Effect } from "effect";
import { QueryLogger } from "./query-logger.ts";
import type {
	QueryLogEntryType,
	QueryLogLevel,
	QueryLogType,
} from "./query-logger.types.ts";

export interface WithQueryLoggingOptions {
	type: QueryLogType;
	sql?: string;
	schema?: string;
	table?: string;
	params: Record<string, any> | ReadonlyArray<any>;
	level: QueryLogLevel;
	/**
	 * Connection ID for database persistence.
	 * Logs will be automatically persisted to the database.
	 */
	connectionId?: string | undefined;
}

const trimSql = (sql: string) =>
	sql
		.split("\n")
		.filter((str) => !str.startsWith("--"))
		.join(" ")
		.trim();

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
			const startTime = new Date();
			const logEntry: Omit<QueryLogEntryType, "id"> = {
				sql: trimSql(options.sql || ""),
				params: options.params,
				type: options.type,
				schema: options.schema,
				table: options.table,
				level: options.level,
				status: "pending",
				startTime,
			};

			const entryId = yield* queryLogger.push(logEntry);

			return yield* effect.pipe(
				Effect.tap((result) => {
					const endTime = new Date();
					const updates: Partial<QueryLogEntryType> = {
						status: "success" as const,
						endTime,
						timeTaken: endTime.getTime() - startTime.getTime(),
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

					return queryLogger.update(entryId, updates);
				}),
				Effect.catchAll((error) => {
					const endTime = new Date();
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					const errorStack = error instanceof Error ? error.stack : undefined;
					const updates = {
						status: "error" as const,
						endTime,
						timeTaken: endTime.getTime() - startTime.getTime(),
						error: {
							message: errorMessage,
							stack: errorStack,
						},
					};

					return queryLogger.update(entryId, updates);
				}),
			);
		}) as Effect.Effect<TOutput, E, R | QueryLogger>;
	};
