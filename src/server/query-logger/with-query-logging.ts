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
	 * Optional connection ID for database persistence.
	 * If provided, logs will be persisted to the database.
	 */
	connectionId?: string;
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

/**
 * Persistent version of withQueryLogging that also saves to database.
 * Requires persistFn and updatePersistFn from query-logger.kysely
 */
export const withQueryLoggingPersistent = <R, E, A>(
	effect: Effect.Effect<A, E, R>,
	options: WithQueryLoggingOptions & {
		persistFn: (
			connectionId: string,
			entry: QueryLogEntryType,
		) => Effect.Effect<void>;
		updatePersistFn: (
			id: string,
			updates: Partial<QueryLogEntryType>,
		) => Effect.Effect<void>;
	},
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

		// Persist initial entry if connectionId provided
		if (options.connectionId) {
			yield* options
				.persistFn(options.connectionId, { ...logEntry, id: entryId })
				.pipe(
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist initial query log ${entryId}`),
						),
					),
				);
		}

		return yield* effect.pipe(
			Effect.tap(() => {
				const endTime = Date.now();
				const updates = {
					status: "success" as const,
					endTime,
					timeTaken: endTime - startTime,
				};
				const updateFx = logger.updateEntry(entryId, updates);

				if (options.connectionId) {
					return updateFx.pipe(
						Effect.andThen(() => options.updatePersistFn(entryId, updates)),
						Effect.catchAll(() =>
							Effect.sync(() =>
								console.warn(
									`Failed to persist query log update for ${entryId}`,
								),
							),
						),
					);
				}
				return updateFx;
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
					Effect.andThen(() =>
						options.connectionId
							? options
									.updatePersistFn(entryId, updates)
									.pipe(
										Effect.catchAll(() =>
											Effect.sync(() =>
												console.warn(
													`Failed to persist error for query log ${entryId}`,
												),
											),
										),
									)
							: Effect.void,
					),
					Effect.andThen(() => Effect.fail(error as E)),
				);
			}),
		);
	});
};

/**
 * Persistent version with row count
 */
export const withQueryLoggingAndRowCountPersistent = <
	R,
	E,
	A extends { rows?: any[]; rowCount?: number },
>(
	effect: Effect.Effect<A, E, R>,
	options: WithQueryLoggingOptions & {
		persistFn: (
			connectionId: string,
			entry: QueryLogEntryType,
		) => Effect.Effect<void>;
		updatePersistFn: (
			id: string,
			updates: Partial<QueryLogEntryType>,
		) => Effect.Effect<void>;
	},
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

		// Persist initial entry if connectionId provided
		if (options.connectionId) {
			yield* options
				.persistFn(options.connectionId, { ...logEntry, id: entryId })
				.pipe(
					Effect.catchAll(() =>
						Effect.sync(() =>
							console.warn(`Failed to persist initial query log ${entryId}`),
						),
					),
				);
		}

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
				const updateFx = logger.updateEntry(entryId, updates);

				if (options.connectionId) {
					return updateFx.pipe(
						Effect.andThen(() => options.updatePersistFn(entryId, updates)),
						Effect.catchAll(() =>
							Effect.sync(() =>
								console.warn(
									`Failed to persist query log update for ${entryId}`,
								),
							),
						),
					);
				}
				return updateFx;
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
					Effect.andThen(() =>
						options.connectionId
							? options
									.updatePersistFn(entryId, updates)
									.pipe(
										Effect.catchAll(() =>
											Effect.sync(() =>
												console.warn(
													`Failed to persist error for query log ${entryId}`,
												),
											),
										),
									)
							: Effect.void,
					),
					Effect.andThen(() => Effect.fail(error as E)),
				);
			}),
		);
	});
};
