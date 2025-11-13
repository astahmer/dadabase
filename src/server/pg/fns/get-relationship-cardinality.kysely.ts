import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";

export type Cardinality = "one-to-one" | "one-to-many";

export interface CardinalityResult {
	cardinality: Cardinality;
}

/**
 * Detect the cardinality of a foreign key relationship by checking if the
 * referencing column(s) have a UNIQUE or PRIMARY KEY constraint.
 *
 * If unique, the relationship is 1-1 (one-to-one).
 * Otherwise, it's 1-N (one-to-many).
 */
export const getRelationshipCardinality = (input: {
	schema: string;
	table: string;
	columns: string[];
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			// Build the array literal for the column names
			const columnsList = input.columns.map((col) => `'${col}'`).join(",");

			const result = yield* db.execute(sql<CardinalityResult>`
				-- Check if the referencing columns have a UNIQUE or PRIMARY KEY constraint
				WITH table_oid AS (
					SELECT oid
					FROM pg_class
					WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ${input.schema})
						AND relname = ${input.table}
				),
				unique_constraint_columns AS (
					SELECT
						con.oid,
						array_agg(a.attname ORDER BY a.attnum)::text[] as constraint_columns
					FROM pg_constraint con
					JOIN pg_class c ON con.conrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
					JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
					WHERE c.oid = (SELECT oid FROM table_oid)
						AND con.contype IN ('p', 'u')  -- PRIMARY KEY or UNIQUE
						AND a.attnum > 0
						AND NOT a.attisdropped
					GROUP BY con.oid
				)
				SELECT
					CASE
						WHEN EXISTS (
							SELECT 1 FROM unique_constraint_columns
							WHERE constraint_columns = ARRAY[${sql.raw(columnsList)}]::text[]
						) THEN 'one-to-one'
						ELSE 'one-to-many'
					END as cardinality
			`);

			if (result.length === 0) {
				// If no result, default to one-to-many
				return { cardinality: "one-to-many" as const };
			}

			return result[0];
		} catch (error) {
			// If there's any error during detection, default to one-to-many
			console.error(
				`Error detecting cardinality for ${input.schema}.${input.table}:`,
				error,
			);
			return { cardinality: "one-to-many" as const };
		}
	});
