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
					kcu1.constraint_name AS "constraintName"
				FROM
					information_schema.key_column_usage kcu1
					LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
					LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
				WHERE
					kcu1.table_schema = ${input.schema}
					AND kcu1.table_name = ${input.table}
					AND kcu1.constraint_name IN (
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
	matchingRowCount: number;
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

/**
 * Get all tables and columns that reference a specific column with row counts
 * Counts how many rows in each referencing table match the given cell value
 * All COUNT queries execute in parallel for efficiency
 */
export const findColumnReferencesWithCounts = (input: {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	cellValue: unknown;
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

			// Execute all COUNT queries in parallel
			// Normalize the cell value: treat string "null" or "undefined" as null
			const normalizedCellValue =
				input.cellValue === undefined || input.cellValue === null
					? null
					: typeof input.cellValue === "string" &&
							(input.cellValue === "null" || input.cellValue === "undefined")
						? null
						: input.cellValue;
			// console.log({ cellValue: input.cellValue, normalizedCellValue });

			const referencesWithCounts = yield* Effect.all(
				references.map((ref) => {
					// If the cell value is null-ish, query for IS NULL to avoid passing
					// string values like "null" or "undefined" into typed columns
					const countQuery =
						normalizedCellValue === null
							? db.execute(sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${sql.table(`${ref.schema}.${ref.table}`)}
								WHERE ${sql.ref(ref.column)} IS NULL
							`)
							: db.execute(sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${sql.table(`${ref.schema}.${ref.table}`)}
								WHERE ${sql.ref(ref.column)} = ${normalizedCellValue}
							`);

					return countQuery.pipe(
						Effect.map((countResult: { count: number }[]) => ({
							...ref,
							matchingRowCount: countResult[0]?.count ?? 0,
						})),
						Effect.catchAll(() =>
							Effect.succeed({
								...ref,
								matchingRowCount: -1, // Default on error
							}),
						),
					);
				}),
			);

			return referencesWithCounts;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't find references to column ${input.referencedSchema}.${input.referencedTable}.${input.referencedColumn}`,
				}),
			);
		}
	});
