import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";

export interface ForeignKeyMetadata {
	columnName: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	constraintName: string;
}

/**
 * Get all foreign keys for a specific table
 */
export const getTableForeignKeys = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			const foreignKeys = yield* db.execute(sql<ForeignKeyMetadata>`
				SELECT
					kcu1.column_name AS "columnName",
					kcu2.table_schema AS "referencedSchema",
					kcu2.table_name AS "referencedTable",
					kcu2.column_name AS "referencedColumn",
					constraint_name AS "constraintName"
				FROM
					information_schema.key_column_usage kcu1
					LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
					LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
				WHERE
					kcu1.table_schema = ${input.schema}
					AND kcu1.table_name = ${input.table}
					AND constraint_name IN (
						SELECT constraint_name
						FROM information_schema.table_constraints
						WHERE constraint_type = 'FOREIGN KEY'
							AND table_schema = ${input.schema}
							AND table_name = ${input.table}
					)
				ORDER BY
					kcu1.ordinal_position
			`);

			return foreignKeys;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't get foreign keys for table ${input.schema}.${input.table}`,
				}),
			);
		}
	});

/**
 * Get all tables and columns that reference a specific column (reverse FK lookup)
 */
export interface ColumnReference {
	schema: string;
	table: string;
	column: string;
	referencedColumn: string;
	constraintName: string;
}

export const findColumnReferences = (input: {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			const references = yield* db.execute(sql<ColumnReference>`
				SELECT
					kcu1.table_schema AS "schema",
					kcu1.table_name AS "table",
					kcu1.column_name AS "column",
					kcu2.column_name AS "referencedColumn",
					kcu1.constraint_name AS "constraintName"
				FROM
					information_schema.key_column_usage kcu1
					LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
					LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
				WHERE
					kcu1.constraint_name IN (
						SELECT constraint_name
						FROM information_schema.table_constraints
						WHERE constraint_type = 'FOREIGN KEY'
					)
					AND kcu2.table_schema = ${input.referencedSchema}
					AND kcu2.table_name = ${input.referencedTable}
					AND kcu2.column_name = ${input.referencedColumn}
				ORDER BY
					kcu1.table_name,
					kcu1.column_name
			`);

			return references;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't find references to column ${input.referencedSchema}.${input.referencedTable}.${input.referencedColumn}`,
				}),
			);
		}
	});
