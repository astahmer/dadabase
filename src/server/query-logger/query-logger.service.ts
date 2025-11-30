import { Effect, Ref } from "effect";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export type QueryLoggerOptions = {
	/**
	 * Connection ID for database persistence. If provided, logs will be automatically
	 * persisted to the database. If omitted, only in-memory storage is used.
	 */
	connectionId?: string;
	/**
	 * Function to persist a query log entry. Called automatically if connectionId is set.
	 */
	persistFn?: (
		connectionId: string,
		entry: QueryLogEntryType,
	) => Effect.Effect<void>;
	/**
	 * Function to update a persisted query log entry.
	 */
	updatePersistFn?: (
		id: string,
		updates: Partial<QueryLogEntryType>,
	) => Effect.Effect<void>;
	/**
	 * Function to delete a persisted query log entry.
	 */
	deletePersistFn?: (id: string) => Effect.Effect<void>;
	/**
	 * Function to clear all persisted query logs.
	 */
	clearPersistFn?: (connectionId: string) => Effect.Effect<void>;
};

export class QueryLogger extends Effect.Service<QueryLogger>()("QueryLogger", {
	effect: Effect.gen(function* () {
		const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

		const createInstance = (options?: QueryLoggerOptions) => ({
			get history() {
				return Ref.get(entriesRef);
			},
			addEntry: (entry: Omit<QueryLogEntryType, "id">) =>
				Effect.gen(function* () {
					const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
					const fullEntry = { ...entry, id };

					yield* Ref.update(entriesRef, (entries) => entries.concat(fullEntry));

					// Optionally persist to database
					if (options?.connectionId && options.persistFn) {
						yield* options
							.persistFn(options.connectionId, fullEntry)
							.pipe(
								Effect.catchAll(() =>
									Effect.sync(() =>
										console.warn(
											`Failed to persist query log ${id} to database`,
										),
									),
								),
							);
					}

					return id;
				}),
			updateEntry: (id: string, updates: Partial<QueryLogEntryType>) =>
				Effect.gen(function* () {
					yield* Ref.update(entriesRef, (entries) =>
						entries.map((entry) =>
							entry.id === id ? { ...entry, ...updates } : entry,
						),
					);

					// Optionally persist to database
					if (options?.updatePersistFn) {
						yield* options
							.updatePersistFn(id, updates)
							.pipe(
								Effect.catchAll(() =>
									Effect.sync(() =>
										console.warn(
											`Failed to update persisted query log ${id} in database`,
										),
									),
								),
							);
					}
				}),
			clearHistory: () =>
				Effect.gen(function* () {
					yield* Ref.set(entriesRef, []);

					// Optionally clear from database
					if (options?.connectionId && options.clearPersistFn) {
						yield* options
							.clearPersistFn(options.connectionId)
							.pipe(
								Effect.catchAll(() =>
									Effect.sync(() =>
										console.warn("Failed to clear query logs from database"),
									),
								),
							);
					}
				}),
			removeEntry: (id: string) =>
				Effect.gen(function* () {
					yield* Ref.update(entriesRef, (entries) =>
						entries.filter((entry) => entry.id !== id),
					);

					// Optionally delete from database
					if (options?.deletePersistFn) {
						yield* options
							.deletePersistFn(id)
							.pipe(
								Effect.catchAll(() =>
									Effect.sync(() =>
										console.warn(
											`Failed to delete persisted query log ${id} from database`,
										),
									),
								),
							);
					}
				}),
		});

		// Return the logger with default (no persistence) options
		return createInstance();
	}),
}) {
	/**
	 * Create a new QueryLogger instance with custom persistence options.
	 * Useful for scoped instances that need to persist logs to specific connections.
	 */
	static withPersistence(options: QueryLoggerOptions) {
		return Effect.gen(function* () {
			const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

			return {
				get history() {
					return Ref.get(entriesRef);
				},
				addEntry: (entry: Omit<QueryLogEntryType, "id">) =>
					Effect.gen(function* () {
						const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
						const fullEntry = { ...entry, id };

						yield* Ref.update(entriesRef, (entries) =>
							entries.concat(fullEntry),
						);

						// Optionally persist to database
						if (options.connectionId && options.persistFn) {
							yield* options
								.persistFn(options.connectionId, fullEntry)
								.pipe(
									Effect.catchAll(() =>
										Effect.sync(() =>
											console.warn(
												`Failed to persist query log ${id} to database`,
											),
										),
									),
								);
						}

						return id;
					}),
				updateEntry: (id: string, updates: Partial<QueryLogEntryType>) =>
					Effect.gen(function* () {
						yield* Ref.update(entriesRef, (entries) =>
							entries.map((entry) =>
								entry.id === id ? { ...entry, ...updates } : entry,
							),
						);

						// Optionally persist to database
						if (options.updatePersistFn) {
							yield* options
								.updatePersistFn(id, updates)
								.pipe(
									Effect.catchAll(() =>
										Effect.sync(() =>
											console.warn(
												`Failed to update persisted query log ${id} in database`,
											),
										),
									),
								);
						}
					}),
				clearHistory: () =>
					Effect.gen(function* () {
						yield* Ref.set(entriesRef, []);

						// Optionally clear from database
						if (options.connectionId && options.clearPersistFn) {
							yield* options
								.clearPersistFn(options.connectionId)
								.pipe(
									Effect.catchAll(() =>
										Effect.sync(() =>
											console.warn("Failed to clear query logs from database"),
										),
									),
								);
						}
					}),
				removeEntry: (id: string) =>
					Effect.gen(function* () {
						yield* Ref.update(entriesRef, (entries) =>
							entries.filter((entry) => entry.id !== id),
						);

						// Optionally delete from database
						if (options.deletePersistFn) {
							yield* options
								.deletePersistFn(id)
								.pipe(
									Effect.catchAll(() =>
										Effect.sync(() =>
											console.warn(
												`Failed to delete persisted query log ${id} from database`,
											),
										),
									),
								);
						}
					}),
			};
		});
	}
}
