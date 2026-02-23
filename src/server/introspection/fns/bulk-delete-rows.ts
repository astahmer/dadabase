import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import {
	QueryLogLevel,
	QueryLogType,
} from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

interface BulkDeleteRowsInput {
	schema: string;
	table: string;
	primaryKeyColumn: string;
	ids: Array<string | number>;
}

/**
 * Deletes multiple rows by their primary key values
 * Uses SqlClient directly with proper query logging
 */
export const bulkDeleteRows = (input: BulkDeleteRowsInput) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const connectionId = yield* RemoteConnection;

		if (input.ids.length === 0) {
			return { rowsAffected: 0 };
		}

		// Build DELETE query with IN clause
		const idList = input.ids
			.map((id) => {
				if (typeof id === "string") {
					// Escape single quotes in string IDs
					return `'${id.replace(/'/g, "''")}'`;
				}
				return String(id);
			})
			.join(",");

		// Build query based on dialect (SQLite/LibSQL don't support schema.table with quotes)
		const sqlQuery = yield* sql.onDialectOrElse({
			pg: () =>
				Effect.succeed(
					`DELETE FROM "${input.schema}"."${input.table}" WHERE "${input.primaryKeyColumn}" IN (${idList})`,
				),
			sqlite: () =>
				Effect.succeed(
					`DELETE FROM "${input.table}" WHERE "${input.primaryKeyColumn}" IN (${idList})`,
				),
			orElse: () => Effect.fail(new Error("Unsupported database dialect")),
		});

		// Execute using SqlClient with proper logging
		const conn = yield* Effect.orDie(sql.reserve).pipe(Effect.scoped);
		const result = yield* conn.executeRaw(sqlQuery, []).pipe(
			withQueryLogging({
				type: QueryLogType.TableRows,
				sql: sqlQuery,
				params: [],
				level: QueryLogLevel.Info,
				connectionId,
				meta: { bulkDelete: true },
			}),
		);

		const rowsAffected =
			(result as any)?.rowCount ??
			(result as any)?.rowsAffected ??
			(result as any)?.affectedRows ??
			0;

		return { rowsAffected };
	});
