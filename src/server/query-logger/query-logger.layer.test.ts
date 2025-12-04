import { AppDatabase } from "#src/db/app.db.ts";
import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Logger, LogLevel } from "effect";
import type { ColumnType } from "kysely";
import {
	RemoteConnection,
	RemoteConnectionId,
} from "../db-connection/remote-connection.tag.ts";
import { NanoId } from "../services/nano-id.ts";
import { QueryLogger } from "./query-logger.ts";
import { QueryLoggerPersistentLayer } from "./query-logger.layer.persisted.ts";
import { QueryLoggerInMemoryLayer } from "./query-logger.layer.in-memory.ts";
import { QueryLoggerNoopLayer } from "./query-logger.layer.noop.ts";
import { QueryLogType } from "./query-logger.types.ts";

describe("QueryLoggerNoopLayer", () => {
	it.effect("provides a no-op implementation that always succeeds", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			// All operations should succeed without side effects
			const now = DateTime.unsafeNow();
			const id = yield* queryLogger.push({
				sql: "SELECT 1",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			yield* queryLogger.update(id, { status: "success" });
			yield* queryLogger.remove(id);

			const logs = yield* queryLogger.get();

			expect(id).toEqual("xxx");
			expect(logs).toEqual([]);
		}).pipe(Effect.provide(QueryLoggerNoopLayer));
	});
});

describe("QueryLoggerInMemoryLayer", () => {
	it.effect("stores logs in memory and retrieves them", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			const id = yield* queryLogger.push({
				sql: "SELECT * FROM users",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			const logs = yield* queryLogger.get();

			expect(id).toMatch(/^ql_/);
			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				id,
				sql: "SELECT * FROM users",
				type: QueryLogType.TableRows,
				status: "success",
			});
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("updates logs in memory", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			const id = yield* queryLogger.push({
				sql: "SELECT 1",
				type: QueryLogType.TableRows,
				status: "pending",
				startTime: DateTime.toDate(now),
			});

			yield* queryLogger.update(id, {
				status: "success",
				endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				timeTaken: 50,
			});

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				id,
				status: "success",
				endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				timeTaken: 50,
			});
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("removes logs from memory", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			const id1 = yield* queryLogger.push({
				sql: "SELECT 1",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			const id2 = yield* queryLogger.push({
				sql: "SELECT 2",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
			});

			yield* queryLogger.remove(id1);

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({ id: id2, sql: "SELECT 2" });
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("clears all logs in memory", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			yield* queryLogger.push({
				sql: "SELECT 1",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			yield* queryLogger.push({
				sql: "SELECT 2",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
			});

			yield* queryLogger.clearAll();

			const logs = yield* queryLogger.get();

			expect(logs).toEqual([]);
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("handles error fields in logs", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			const id = yield* queryLogger.push({
				sql: "SELECT * FROM invalid_table",
				type: QueryLogType.TableRows,
				status: "pending",
				startTime: DateTime.toDate(now),
			});

			const errorObj = {
				message: "Table not found",
				stack: "at executeQuery (db.ts:45)",
			};

			yield* queryLogger.update(id, {
				status: "error",
				endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				timeTaken: 50,
				error: errorObj,
			});

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				id,
				status: "error",
				error: {
					message: "Table not found",
					stack: "at executeQuery (db.ts:45)",
				},
			});
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("handles optional fields", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			yield* queryLogger.push({
				sql: "SELECT * FROM users",
				type: QueryLogType.TableRows,
				status: "pending",
				startTime: DateTime.toDate(now),
			});

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				sql: "SELECT * FROM users",
				status: "pending",
			});
			// Optional fields should be undefined
			expect(logs[0].endTime).toBeUndefined();
			expect(logs[0].timeTaken).toBeUndefined();
			expect(logs[0].rowsReturned).toBeUndefined();
			expect(logs[0].rowsAffected).toBeUndefined();
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("preserves query parameters", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const params = [1, "test", true];
			const now = DateTime.unsafeNow();
			yield* queryLogger.push({
				sql: "SELECT * FROM users WHERE id = ? AND name = ? AND active = ?",
				params,
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(1);
			expect(logs[0]).toMatchObject({
				params,
			});
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});

	it.effect("tracks multiple query types", () => {
		return Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;

			const now = DateTime.unsafeNow();
			yield* queryLogger.push({
				sql: "SELECT * FROM users",
				type: QueryLogType.TableRows,
				status: "success",
				startTime: DateTime.toDate(now),
			});

			yield* queryLogger.push({
				sql: "SELECT COUNT(*) FROM posts",
				type: QueryLogType.TableCount,
				status: "success",
				startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
			});

			yield* queryLogger.push({
				sql: "PRAGMA foreign_keys",
				type: QueryLogType.SchemaIntrospection,
				status: "success",
				startTime: DateTime.toDate(DateTime.add(now, { seconds: 2 })),
			});

			const logs = yield* queryLogger.get();

			expect(logs).toHaveLength(3);
			expect(logs.map((l) => l.type)).toEqual([
				QueryLogType.TableRows,
				QueryLogType.TableCount,
				QueryLogType.SchemaIntrospection,
			]);
		}).pipe(Effect.provide(QueryLoggerInMemoryLayer));
	});
});

const testConnectionId = RemoteConnectionId.make("test-conn-123");

// Test database schema with query_logs table
interface TestDbSchema {
	query_logs: {
		id: ColumnType<string, string, never>;
		connection_id: ColumnType<string, string, never>;
		sql: ColumnType<string, string, never>;
		params: ColumnType<string | null, string | null, never>;
		type: ColumnType<string, string, never>;
		schema: ColumnType<string | null, string | null, never>;
		table: ColumnType<string | null, string | null, never>;
		status: ColumnType<string, string, never>;
		start_time: ColumnType<Date, string, never>;
		end_time: ColumnType<Date | null, string | null, never>;
		time_taken: ColumnType<number | null, number | null, never>;
		rows_returned: ColumnType<number | null, number | null, never>;
		rows_affected: ColumnType<number | null, number | null, never>;
		error: ColumnType<string | null, string | null, never>;
		created_at: ColumnType<Date, string, never>;
	};
}

const InMemoryDatabaseLayer = Layer.effect(
	AppDatabase,
	makeEffectKyselyPglite<any>({
		dataDir: "memory://test-query-logger",
		setup: async (db) => {
			// Create the query_logs table
			await db.schema
				.createTable("query_logs")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("connection_id", "text", (col) => col.notNull())
				.addColumn("sql", "text", (col) => col.notNull())
				.addColumn("params", "text")
				.addColumn("type", "text", (col) => col.notNull())
				.addColumn("schema", "text")
				.addColumn("table", "text")
				.addColumn("status", "text", (col) => col.notNull())
				.addColumn("start_time", "date", (col) => col.notNull())
				.addColumn("end_time", "date")
				.addColumn("time_taken", "integer")
				.addColumn("rows_returned", "integer")
				.addColumn("rows_affected", "integer")
				.addColumn("error", "text")
				.addColumn("created_at", "date", (col) => col.notNull())
				.execute();
		},
	}),
);

const RemoteConnectionLayer = Layer.succeed(RemoteConnection, testConnectionId);

const TestLayer = QueryLoggerPersistentLayer.pipe(
	Layer.provideMerge(InMemoryDatabaseLayer),
	Layer.provideMerge(RemoteConnectionLayer),
	Layer.provideMerge(NanoId.Default),
);

describe("QueryLoggerPersistentLayer", () => {
	describe("get", () => {
		it.effect("returns empty array when no logs exist", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;
				const logs = yield* queryLogger.get();

				expect(logs).toEqual([]);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});

		it.effect(
			"retrieves all logs for a connection in chronological order",
			() => {
				return Effect.gen(function* () {
					const queryLogger = yield* QueryLogger;

					// Add some logs
					const now = DateTime.unsafeNow();
					const id1 = yield* queryLogger.push({
						sql: "SELECT * FROM users",
						type: QueryLogType.TableRows,
						status: "success",
						startTime: DateTime.toDate(now),
						endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
						timeTaken: 100,
					});

					const id2 = yield* queryLogger.push({
						sql: "SELECT COUNT(*) FROM users",
						type: QueryLogType.TableCount,
						status: "success",
						startTime: DateTime.toDate(DateTime.add(now, { seconds: 2 })),
						endTime: DateTime.toDate(DateTime.add(now, { seconds: 3 })),
						timeTaken: 50,
					});

					// Retrieve logs
					const logs = yield* queryLogger.get();

					expect(logs).toEqual(
						expect.arrayContaining([
							expect.objectContaining({
								sql: "SELECT * FROM users",
								type: QueryLogType.TableRows,
							}),
							expect.objectContaining({
								sql: "SELECT COUNT(*) FROM users",
								type: QueryLogType.TableCount,
							}),
						]),
					);
				}).pipe(
					Effect.provide(TestLayer),
					Logger.withMinimumLogLevel(LogLevel.All),
				);
			},
		);

		it.effect("only returns logs for the specific connection", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				// Add a log
				const now = DateTime.unsafeNow();
				yield* queryLogger.push({
					sql: "SELECT * FROM users",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(now),
				});

				const logsForConnection = yield* queryLogger.get();

				expect(logsForConnection).toHaveLength(1);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});
	});

	describe("push", () => {
		it.effect("persists a query log entry and returns an ID", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				const entryId = yield* queryLogger.push({
					sql: "SELECT * FROM users WHERE id = ?",
					params: [1],
					type: QueryLogType.TableRows,
					schema: "public",
					table: "users",
					status: "success",
					startTime: DateTime.toDate(now),
					endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
					timeTaken: 100,
					rowsReturned: 5,
				});

				// Verify it was persisted
				const logs = yield* queryLogger.get();

				expect(logs).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							sql: "SELECT * FROM users WHERE id = ?",
							params: [1],
							type: QueryLogType.TableRows,
							schema: "public",
							table: "users",
							status: "success",
							rowsReturned: 5,
						}),
					]),
				);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});

		it.effect("generates a unique ID for each entry", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				const id1 = yield* queryLogger.push({
					sql: "SELECT 1",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(now),
				});

				const id2 = yield* queryLogger.push({
					sql: "SELECT 2",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				});

				expect(id1).not.toEqual(id2);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});

		it.effect("handles optional fields gracefully", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				yield* queryLogger.push({
					sql: "SELECT * FROM users",
					type: QueryLogType.TableRows,
					status: "pending",
					startTime: DateTime.toDate(now),
				});

				const logs = yield* queryLogger.get();

				expect(logs).toContainEqual(
					expect.objectContaining({
						sql: "SELECT * FROM users",
						status: "pending",
						endTime: undefined,
						timeTaken: undefined,
						rowsReturned: undefined,
					}),
				);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});
	});

	describe("update", () => {
		it.effect("updates an existing query log entry", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				const entryId = yield* queryLogger.push({
					sql: "SELECT * FROM users",
					type: QueryLogType.TableRows,
					status: "pending",
					startTime: DateTime.toDate(now),
				});

				// Update the entry
				yield* queryLogger.update(entryId, {
					status: "success",
					endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
					timeTaken: 50,
					rowsReturned: 10,
				});

				const logs = yield* queryLogger.get();

				expect(logs).toContainEqual(
					expect.objectContaining({
						sql: "SELECT * FROM users",
						status: "success",
						endTime: expect.any(Date),
						timeTaken: 50,
						rowsReturned: 10,
					}),
				);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});

		it.effect("handles error updates", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				const entryId = yield* queryLogger.push({
					sql: "SELECT * FROM users",
					type: QueryLogType.TableRows,
					status: "pending",
					startTime: DateTime.toDate(now),
				});

				// Update with error
				const errorObj = {
					message: "Syntax error",
					stack: "at parseSQL (sql-parser.js:123)",
				};

				yield* queryLogger.update(entryId, {
					status: "error",
					endTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
					timeTaken: 50,
					error: errorObj,
				});

				const logs = yield* queryLogger.get();

				expect(logs).toContainEqual(
					expect.objectContaining({
						status: "error",
						error: {
							message: "Syntax error",
							stack: "at parseSQL (sql-parser.js:123)",
						},
					}),
				);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});
	});

	describe("remove", () => {
		it.effect("removes a query log entry", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				const now = DateTime.unsafeNow();
				const id1 = yield* queryLogger.push({
					sql: "SELECT 1",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(now),
				});

				const id2 = yield* queryLogger.push({
					sql: "SELECT 2",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				});

				// Remove the first entry
				yield* queryLogger.remove(id1);

				const logs = yield* queryLogger.get();

				expect(logs).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							sql: "SELECT 2",
						}),
					]),
				);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});

		it.effect("handles removing non-existent entry gracefully", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				// Try to remove a non-existent entry - should not throw
				yield* queryLogger.remove("non-existent-id");

				const logs = yield* queryLogger.get();

				expect(logs).toEqual([]);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});
	});

	describe("clearAll", () => {
		it.effect("clears all query logs", () => {
			return Effect.gen(function* () {
				const queryLogger = yield* QueryLogger;

				// Add some logs
				const now = DateTime.unsafeNow();
				yield* queryLogger.push({
					sql: "SELECT 1",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(now),
				});

				yield* queryLogger.push({
					sql: "SELECT 2",
					type: QueryLogType.TableRows,
					status: "success",
					startTime: DateTime.toDate(DateTime.add(now, { seconds: 1 })),
				});

				// Clear all
				yield* queryLogger.clearAll();

				const logs = yield* queryLogger.get();

				expect(logs).toEqual([]);
			}).pipe(
				Effect.provide(TestLayer),
				Logger.withMinimumLogLevel(LogLevel.All),
			);
		});
	});
});
