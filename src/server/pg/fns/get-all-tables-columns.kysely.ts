import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";

export interface TableColumnsMetadata {
	table: string;
	columns: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		unique: boolean;
		defaultValue: string | null;
	}>;
}

export const getAllTablesColumns = (input: { schema: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			// Get all tables in the schema first
			const tableNames = yield* db.execute(sql<{ tablename: string }>`
				SELECT tablename
				FROM pg_tables
				WHERE schemaname = ${input.schema}
				ORDER BY tablename
			`);

			// For each table, fetch its columns metadata
			const allTablesColumns: TableColumnsMetadata[] = [];

			for (const tableRecord of tableNames) {
				const tableName = tableRecord.tablename;

				const columns = yield* db.execute(sql<{
					name: string;
					dataType: string;
					nullable: boolean;
					primaryKey: boolean;
					unique: boolean;
					defaultValue: string | null;
				}>`
					SELECT
						a.attname as name,
						format_type(a.atttypid, a.atttypmod) as "dataType",
						NOT a.attnotnull as nullable,
						(t.contype = 'p') as "primaryKey",
						(u.contype = 'u') as "unique",
						pg_get_expr(d.adbin, d.adrelid) as "defaultValue"
					FROM
						pg_attribute a
						LEFT JOIN pg_constraint t ON a.attrelid = t.conrelid AND a.attnum = ANY(t.conkey) AND t.contype = 'p'
						LEFT JOIN pg_constraint u ON a.attrelid = u.conrelid AND a.attnum = ANY(u.conkey) AND u.contype = 'u'
						LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
						JOIN pg_class c ON a.attrelid = c.oid
						JOIN pg_namespace n ON c.relnamespace = n.oid
					WHERE
						n.nspname = ${input.schema}
						AND c.relname = ${tableName}
						AND a.attnum > 0
						AND NOT a.attisdropped
					ORDER BY
						a.attnum
				`);

				allTablesColumns.push({
					table: tableName,
					columns,
				});
			}

			return allTablesColumns;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't get columns for tables in schema ${input.schema}`,
				}),
			);
		}
	});
