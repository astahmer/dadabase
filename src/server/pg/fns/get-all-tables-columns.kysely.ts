import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";

export interface ForeignKeyInfo {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
}

export interface TableColumnsMetadata {
	table: string;
	columns: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		unique: boolean;
		defaultValue: string | null;
		isForeignKey?: boolean;
		foreignKey?: ForeignKeyInfo;
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

				// First, get all foreign keys for this table
				const foreignKeys = yield* db.execute(sql<{
					columnName: string;
					referencedSchema: string;
					referencedTable: string;
					referencedColumn: string;
				}>`
					SELECT
						kcu1.column_name AS "columnName",
						kcu2.table_schema AS "referencedSchema",
						kcu2.table_name AS "referencedTable",
						kcu2.column_name AS "referencedColumn"
					FROM
						information_schema.key_column_usage kcu1
						LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
						LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
					WHERE
						kcu1.table_schema = ${input.schema}
						AND kcu1.table_name = ${tableName}
						AND kcu1.constraint_name IN (
							SELECT constraint_name
							FROM information_schema.table_constraints
							WHERE constraint_type = 'FOREIGN KEY'
								AND table_schema = ${input.schema}
								AND table_name = ${tableName}
						)
				`);

				// Create a map for quick FK lookup
				const fkMap = new Map<
					string,
					{
						referencedSchema: string;
						referencedTable: string;
						referencedColumn: string;
					}
				>();
				foreignKeys.forEach((fk) => {
					fkMap.set(fk.columnName, {
						referencedSchema: fk.referencedSchema,
						referencedTable: fk.referencedTable,
						referencedColumn: fk.referencedColumn,
					});
				});

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

				// Merge FK info with column metadata
				const columnsWithFK = columns.map((col) => ({
					...col,
					isForeignKey: fkMap.has(col.name),
					foreignKey: fkMap.get(col.name),
				}));

				allTablesColumns.push({
					table: tableName,
					columns: columnsWithFK,
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
