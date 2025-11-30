import { Effect } from "effect";
import { AppDatabase } from "#src/db/app.db.ts";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export const getQueryLogs = (connectionId: string, limit: number = 100) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		const rows = yield* db.execute(
			db
				.selectFrom("query_logs")
				.selectAll()
				.where("connection_id", "=", connectionId)
				.orderBy("created_at", "desc")
				.limit(limit),
		);
		return rows
			.map(
				(row) =>
					({
						id: row.id,
						sql: row.sql,
						params: row.params ? JSON.parse(row.params) : undefined,
						type: row.type,
						schema: row.schema ?? undefined,
						table: row.table ?? undefined,
						status: row.status as "pending" | "success" | "error",
						startTime: row.start_time,
						endTime: row.end_time ?? undefined,
						timeTaken: row.time_taken ?? undefined,
						rowsReturned: row.rows_returned ?? undefined,
						rowsAffected: row.rows_affected ?? undefined,
						error: row.error ? JSON.parse(row.error) : undefined,
					}) as QueryLogEntryType,
			)
			.reverse(); // Reverse to get chronological order (oldest first)
	});

/**
 * Keep only the last 1000 query logs for a given connection.
 * Deletes older entries to prevent unbounded table growth.
 */
const cleanupOldQueryLogs = (connectionId: string) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		// Get IDs of logs to delete (keeping only the last 1000)
		const logsToDelete = yield* db.execute(
			db
				.selectFrom("query_logs")
				.select("id")
				.where("connection_id", "=", connectionId)
				.orderBy("created_at", "desc")
				.offset(1000),
		);

		if (logsToDelete.length > 0) {
			const idsToDelete = logsToDelete.map((row) => row.id);
			yield* db.execute(
				db.deleteFrom("query_logs").where("id", "in", idsToDelete),
			);
		}
	});

/**
 * Curried version for use with withQueryLogging wrappers
 */
export const persistQueryLog = (
	connectionId: string,
	entry: QueryLogEntryType,
) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		yield* db.execute(
			db.insertInto("query_logs").values({
				id: entry.id,
				connection_id: connectionId,
				sql: entry.sql,
				params: entry.params ? JSON.stringify(entry.params) : null,
				type: entry.type,
				schema: entry.schema ?? null,
				table: entry.table ?? null,
				status: entry.status,
				start_time: entry.startTime,
				end_time: entry.endTime ?? null,
				time_taken: entry.timeTaken ?? null,
				rows_returned: entry.rowsReturned ?? null,
				rows_affected: entry.rowsAffected ?? null,
				error: entry.error ? JSON.stringify(entry.error) : null,
				created_at: Date.now(),
			}),
		);
		// Cleanup old logs to keep only the last 1000
		yield* cleanupOldQueryLogs(connectionId);
	});

export const updatePersistedQueryLog = (
	id: string,
	updates: Partial<QueryLogEntryType>,
) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;

		yield* db.execute(
			db
				.updateTable("query_logs")
				.set({
					status: updates.status ?? undefined,
					end_time: updates.endTime ?? undefined,
					time_taken: updates.timeTaken ?? undefined,
					rows_returned: updates.rowsReturned ?? undefined,
					rows_affected: updates.rowsAffected ?? undefined,
					error: updates.error ? JSON.stringify(updates.error) : undefined,
				})
				.where("id", "=", id),
		);
	});

export const deleteQueryLog = (id: string) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		yield* db.execute(db.deleteFrom("query_logs").where("id", "=", id));
	});

export const saveFavorite = (input: {
	connectionId: string;
	label: string;
	sql: string;
	description?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		// TODO NanoId
		const id = `qf_${Math.random().toString(36).substr(2, 9)}`;

		yield* db.execute(
			db.insertInto("query_favorites").values({
				id,
				connection_id: input.connectionId,
				label: input.label,
				sql: input.sql,
				description: input.description ?? null,
				created_at: Date.now(),
				updated_at: Date.now(),
			}),
		);

		return id;
	});

export const deleteFavorite = (id: string) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		yield* db.execute(db.deleteFrom("query_favorites").where("id", "=", id));
	});

export const getFavorites = (connectionId: string) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		const rows = yield* db.execute(
			db
				.selectFrom("query_favorites")
				.selectAll()
				.where("connection_id", "=", connectionId)
				.orderBy("created_at", "desc"),
		);
		return rows;
	});
