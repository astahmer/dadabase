import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";

export type Cardinality =
	| "one-to-one"
	| "one-to-many"
	| "many-to-one"
	| "many-to-many";

export interface CardinalityResult {
	cardinality: Cardinality;
}

/**
 * Detect the cardinality of a foreign key relationship.
 *
 * Checks:
 * 1. If the referencing columns have a UNIQUE/PRIMARY KEY constraint → potentially 1:1 or 1:N
 * 2. If the referenced columns are unique (PK of referenced table) → indicates 1:N or 1:1
 * 3. If neither side is unique → M:N (many-to-many)
 *
 * Returns:
 * - 1:1 (one-to-one): FK is unique AND references PK
 * - 1:N (one-to-many): Referenced side is PK AND FK is not unique (one row can have many references)
 * - N:1 (many-to-one): FK is not unique (many rows reference one row)
 * - M:N (many-to-many): Neither side is unique (typically via junction table)
 */
export const getRelationshipCardinality = (input: {
	schema: string;
	table: string;
	columns: string[];
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			const result = yield* db.execute(sql<CardinalityResult>`
				-- Determine cardinality of FK relationship
				WITH table_oid AS (
					SELECT oid
					FROM pg_class
					WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ${input.schema})
						AND relname = ${input.table}
				),
				fk_constraints AS (
					SELECT
						con.oid,
						con.confrelid,
						array_agg(a.attname ORDER BY a.attnum)::text[] as fk_columns,
						array_agg(af.attname ORDER BY af.attnum)::text[] as referenced_columns
					FROM pg_constraint con
					JOIN pg_class c ON con.conrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
					JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
					JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
					WHERE c.oid = (SELECT oid FROM table_oid)
						AND con.contype = 'f'  -- FOREIGN KEY
						AND a.attnum > 0
						AND NOT a.attisdropped
					GROUP BY con.oid, con.confrelid
				),
				fk_side_unique AS (
					SELECT
						fk.oid,
						EXISTS (
							SELECT 1 FROM pg_constraint con2
							WHERE con2.conrelid = (SELECT oid FROM table_oid)
								AND con2.contype IN ('p', 'u')
								AND array_agg(a2.attname ORDER BY a2.attnum)::text[] = fk.fk_columns
							FROM pg_attribute a2
							WHERE a2.attrelid = con2.conrelid AND a2.attnum = ANY(con2.conkey)
						) as fk_is_unique
					FROM fk_constraints fk
				),
				referenced_side_unique AS (
					SELECT
						fk.oid,
						EXISTS (
							SELECT 1 FROM pg_constraint con3
							WHERE con3.conrelid = fk.confrelid
								AND con3.contype = 'p'  -- PRIMARY KEY
								AND array_agg(a3.attname ORDER BY a3.attnum)::text[] = fk.referenced_columns
							FROM pg_attribute a3
							WHERE a3.attrelid = con3.conrelid AND a3.attnum = ANY(con3.conkey)
						) as referenced_is_pk
					FROM fk_constraints fk
				)
				SELECT
					CASE
						WHEN fk_side_unique AND referenced_is_pk THEN 'one-to-one'
						WHEN NOT fk_side_unique AND referenced_is_pk THEN 'many-to-one'
						WHEN fk_side_unique AND NOT referenced_is_pk THEN 'one-to-many'
						ELSE 'many-to-many'
					END as cardinality
				FROM fk_constraints fk
				JOIN fk_side_unique fk_u ON fk.oid = fk_u.oid
				JOIN referenced_side_unique ref_u ON fk.oid = ref_u.oid
			`);

			if (result.length === 0) {
				// If no result, default to many-to-one (most common)
				return { cardinality: "many-to-one" as const };
			}

			return result[0];
		} catch (error) {
			// If there's any error during detection, default to many-to-one
			console.error(
				`Error detecting cardinality for ${input.schema}.${input.table}:`,
				error,
			);
			return { cardinality: "many-to-one" as const };
		}
	});
