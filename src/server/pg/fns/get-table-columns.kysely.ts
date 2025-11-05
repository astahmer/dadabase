import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";

export interface ColumnMetadata {
	name: string;
	dataType: string;
	nullable: boolean;
	primaryKey: boolean;
	defaultValue: string | null;
}

export const getTableColumns = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			const columns = yield* db.execute(sql<ColumnMetadata>`
				SELECT
					a.attname as name,
					format_type(a.atttypid, a.atttypmod) as "dataType",
					NOT a.attnotnull as nullable,
					(t.contype = 'p') as "primaryKey",
					pg_get_expr(d.adbin, d.adrelid) as "defaultValue"
				FROM
					pg_attribute a
					LEFT JOIN pg_constraint t ON a.attrelid = t.conrelid AND a.attnum = ANY(t.conkey) AND t.contype = 'p'
					LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
					JOIN pg_class c ON a.attrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
				WHERE
					n.nspname = ${input.schema}
					AND c.relname = ${input.table}
					AND a.attnum > 0
					AND NOT a.attisdropped
				ORDER BY
					a.attnum
			`);
			return columns;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't get columns for table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
