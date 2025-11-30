import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";

/**
 * Get available schemas for PostgreSQL.
 * Uses multi-dialect logic from introspection module adapted for Kysely.
 */
export const getAvailableSchemas = Effect.gen(function* () {
	const db = yield* KyselyPgDatabase;
	// PostgreSQL: Query information_schema.schemata, excluding system schemas
	const rows = yield* db.execute(
		sql<{ schema_name: string }>`
			SELECT schema_name FROM information_schema.schemata
			WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
			ORDER BY schema_name
		`,
	);
	return rows.map((row) => row.schema_name);
});
