import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";

/**
 * Get available tables for a schema in PostgreSQL.
 * Uses multi-dialect logic from introspection module adapted for Kysely.
 */
export const getAvailableTableList = Effect.gen(function* () {
	const db = yield* KyselyPgDatabase;
	// PostgreSQL: Query information_schema.tables for BASE TABLEs in all schemas
	const tables = yield* db.execute(
		sql<{ name: string; schema: string }>`
			SELECT table_name as name, table_schema as schema
			FROM information_schema.tables
			WHERE table_type = 'BASE TABLE'
			AND table_schema = 'public'
			ORDER BY table_name
		`,
	);
	return tables;
});
