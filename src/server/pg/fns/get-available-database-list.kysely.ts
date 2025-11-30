import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import { Effect } from "effect";
import { sql } from "kysely";

/**
 * Get available databases for PostgreSQL.
 * Uses multi-dialect logic from introspection module adapted for Kysely.
 */
export const getAvailableDatabaseList = (input: { connectionId?: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		// PostgreSQL: Query pg_catalog.pg_database
		const query = sql<{ datname: string }>`
			SELECT datname FROM pg_catalog.pg_database ORDER BY datname
		`;
		const rows = yield* db.execute(query).pipe(
			withQueryLogging({
				type: QueryLogType.SchemaIntrospection,
				sql: "SELECT datname FROM pg_catalog.pg_database ORDER BY datname",
				params: [],
				connectionId: input.connectionId,
			}),
		);
		return rows;
	});
