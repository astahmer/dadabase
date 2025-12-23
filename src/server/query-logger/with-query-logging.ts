import { Cause, Effect } from "effect";
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
	meta?: Record<string, any>;
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
				meta: options.meta,
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
					// Check for rowCount (PostgreSQL) or changes (libSQL/SQLite)
					if (result && typeof result === "object") {
						if ("rowCount" in result && typeof result.rowCount === "number") {
							updates.rowsAffected = result.rowCount;
						} else if (
							"changes" in result &&
							typeof result.changes === "number"
						) {
							updates.rowsAffected = result.changes;
						}
					}

					return queryLogger.update(entryId, updates);
				}),
				Effect.catchAll((error) => {
					const endTime = new Date();
					const errorMessage = getErrorMessage(error);

					const errorStack =
						error instanceof Error
							? Cause.pretty(
									Cause.isCause(error.cause) ? error.cause : Cause.fail(error),
									{ renderErrorCause: true },
								)
							: String(error);
					const updates = {
						status: "error" as const,
						endTime,
						timeTaken: endTime.getTime() - startTime.getTime(),
						error: {
							message: errorMessage!,
							stack: errorStack,
						},
					};

					return queryLogger.update(entryId, updates);
				}),
			);
		}) as Effect.Effect<TOutput, E, R | QueryLogger>;
	};

function getErrorMessage(error: unknown): string {
	let errorMessage: string | undefined;
	if (error instanceof Error && error.cause) {
		if (Cause.isCause(error.cause)) {
			errorMessage = Cause.pretty(error.cause);
		} else if (error.cause instanceof Error) {
			errorMessage = getErrorMessage(error.cause);
		}
	}

	if (!errorMessage) {
		errorMessage = String(error);
	}

	return errorMessage;
}
