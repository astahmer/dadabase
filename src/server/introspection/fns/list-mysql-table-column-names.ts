import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * Fetch ordered column names for a MySQL table (for no-PK fingerprint WHERE clauses).
 * Kept out of introspection.ts to avoid circular imports with row-mutation fns.
 */
export const listMysqlTableColumnNames = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const query = input.schema
      ? sql<{ name: string }>`
					SELECT COLUMN_NAME as name
					FROM information_schema.COLUMNS
					WHERE TABLE_SCHEMA = ${input.schema}
						AND TABLE_NAME = ${input.table}
					ORDER BY ORDINAL_POSITION
				`
      : sql<{ name: string }>`
					SELECT COLUMN_NAME as name
					FROM information_schema.COLUMNS
					WHERE TABLE_SCHEMA = DATABASE()
						AND TABLE_NAME = ${input.table}
					ORDER BY ORDINAL_POSITION
				`;
    const rows = yield* query;
    return rows.map((r) => r.name);
  });
