import { Effect } from "effect";
import { QueryLogger } from "./query-logger.service.ts";
import type { QueryLogEntryType, QueryLogType } from "./query-logger.types.ts";

export interface WithQueryLoggingOptions {
	type: QueryLogType;
	sql?: string;
	schema?: string;
	table?: string;
	params?: Record<string, any> | ReadonlyArray<any>;
}

/**
 * Wraps an Effect with automatic query logging
 * Logs the query execution with timing, status, and any errors
 *
 * @example
 * const result = yield* withQueryLogging(
 *   Effect.succeed({ rows: [...] }),
 *   {
 *     type: "table",
 *     sql: "SELECT * FROM users",
 *     schema: "public",
 *     table: "users"
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

		return yield* effect.pipe(
			Effect.tap(() => {
				const endTime = Date.now();
				return logger.updateEntry(entryId, {
					status: "success",
					endTime,
					timeTaken: endTime - startTime,
				});
			}),
			Effect.catchAll((error) => {
				const endTime = Date.now();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;
				return logger
					.updateEntry(entryId, {
						status: "error",
						endTime,
						timeTaken: endTime - startTime,
						error: {
							message: errorMessage,
							stack: errorStack,
						},
					})
					.pipe(Effect.andThen(() => Effect.fail(error as E)));
			}),
		);
	});
};

/**
 * Alternative version that returns the result and also logs row count
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

		return yield* effect.pipe(
			Effect.tap((result) => {
				const endTime = Date.now();
				return logger.updateEntry(entryId, {
					status: "success",
					endTime,
					timeTaken: endTime - startTime,
					rowsReturned: result.rows?.length ?? 0,
					rowsAffected: result.rowCount,
				});
			}),
			Effect.catchAll((error) => {
				const endTime = Date.now();
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;
				return logger
					.updateEntry(entryId, {
						status: "error",
						endTime,
						timeTaken: endTime - startTime,
						error: {
							message: errorMessage,
							stack: errorStack,
						},
					})
					.pipe(Effect.andThen(() => Effect.fail(error as E)));
			}),
		);
	});
};
