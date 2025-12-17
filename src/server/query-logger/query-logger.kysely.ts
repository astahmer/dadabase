import { Effect } from "effect";
import { AppDatabase } from "#src/db/app.db.ts";
import type {
	QueryLogEntryType,
	QueryLogFilters,
} from "./query-logger.types.ts";

export const getQueryLogs = (
	connectionId: string,
	filters?: QueryLogFilters,
	limit: number = 1000,
) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		let query = db
			.selectFrom("query_logs")
			.selectAll()
			.where("connection_id", "=", connectionId);

		// Apply type filter
		if (filters?.type) {
			const types = Array.isArray(filters.type) ? filters.type : [filters.type];
			if (types.length > 0) {
				query = query.where("type", "in", types);
			}
		}

		if (filters?.level) {
			const levels = Array.isArray(filters.level)
				? filters.level
				: [filters.level];
			if (levels.length > 0) {
				query = query.where("level", "in", levels);
			}
		}

		// Apply schema filter
		if (filters?.schema) {
			query = query.where("schema", "=", filters.schema);
		}

		// Apply table filter
		if (filters?.table) {
			query = query.where("table", "=", filters.table);
		}

		const countQuery = query
			.clearSelect()
			.select((eb) => [
				eb.fn
					.countAll()
					.filterWhere("status", "=", "pending")
					.over()
					.$castTo<number>()
					.as("pending_count"),
				eb.fn
					.countAll()
					.filterWhere("status", "=", "success")
					.over()
					.$castTo<number>()
					.as("success_count"),
				eb.fn
					.countAll()
					.filterWhere("status", "=", "error")
					.over()
					.$castTo<number>()
					.as("error_count"),
			]);

		// Apply status filter
		if (filters?.status) {
			const statuses = Array.isArray(filters.status)
				? filters.status
				: [filters.status];
			query = query.where("status", "in", statuses);
		}

		// console.log(query.compile());
		const [rows, counts] = yield* Effect.all([
			db.execute(query.orderBy("created_at", "desc").limit(limit)),
			db.executeTakeFirstOrUndefined(countQuery),
		]);

		return {
			rows: rows
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
							level: Number(row.level),
							startTime: new Date(row.start_time),
							endTime: row.end_time ? new Date(row.end_time) : undefined,
							timeTaken: row.time_taken ?? undefined,
							rowsReturned: row.rows_returned ?? undefined,
							rowsAffected: row.rows_affected ?? undefined,
							error: row.error ? JSON.parse(row.error) : undefined,
							meta: row.meta ? JSON.parse(row.meta) : undefined,
						}) as QueryLogEntryType,
				)
				// Reverse to get chronological order (oldest first),
				.reverse(),
			counts: {
				pending: counts?.pending_count ?? 0,
				success: counts?.success_count ?? 0,
				error: counts?.error_count ?? 0,
			},
		};
	});

/**
 * Keep only the last 1000 query logs for a given connection.
 * Deletes older entries to prevent unbounded table growth.
 */
const cleanupOldQueryLogs = (connectionId: string) =>
	Effect.gen(function* () {
		const db = yield* AppDatabase;
		// Get IDs of logs to delete (keeping only the last 1000)
		// Note: SQLite requires LIMIT with OFFSET, so we use a large LIMIT
		const logsToDelete = yield* db.execute(
			db
				.selectFrom("query_logs")
				.select("id")
				.where("connection_id", "=", connectionId)
				.orderBy("created_at", "desc")
				.limit(1000)
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
				level: entry.level,
				status: entry.status,
				start_time: entry.startTime.getTime(),
				end_time: entry.endTime ? entry.endTime.getTime() : null,
				time_taken: entry.timeTaken ?? null,
				rows_returned: entry.rowsReturned ?? null,
				rows_affected: entry.rowsAffected ?? null,
				error: entry.error ? JSON.stringify(entry.error) : null,
				created_at: Date.now(),
				meta: entry.meta ? JSON.stringify(entry.meta) : null,
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
					end_time: updates.endTime ? updates.endTime.getTime() : undefined,
					time_taken: updates.timeTaken ?? undefined,
					rows_returned: updates.rowsReturned ?? undefined,
					rows_affected: updates.rowsAffected ?? undefined,
					error: updates.error ? JSON.stringify(updates.error) : undefined,
					meta: updates.meta ? JSON.stringify(updates.meta) : undefined,
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
