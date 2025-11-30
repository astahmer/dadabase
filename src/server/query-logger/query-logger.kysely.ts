import { Effect } from "effect";
import { AppDatabase } from "#src/db/app.db.ts";
import type { QueryLogEntryType } from "./query-logger.types.ts";

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
		return rows.map((row) => ({
			...row,
			params: row.params ? JSON.parse(row.params) : undefined,
			error: row.error ? JSON.parse(row.error) : undefined,
		}));
	});
