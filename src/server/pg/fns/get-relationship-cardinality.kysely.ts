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
				fk_info AS (
					SELECT
						con.oid,
						con.conrelid,
						con.confrelid,
						con.conkey,
						con.confkey
					FROM pg_constraint con
					WHERE con.conrelid = (SELECT oid FROM table_oid)
						AND con.contype = 'f'  -- FOREIGN KEY
				),
				fk_side_unique AS (
					SELECT
						fk.oid,
						COALESCE(
							EXISTS (
								SELECT 1 FROM pg_constraint con2
								WHERE con2.conrelid = fk.conrelid
									AND con2.contype IN ('p', 'u')
									AND con2.conkey = fk.conkey
							),
							false
						) as fk_is_unique
					FROM fk_info fk
				),
				referenced_side_unique AS (
					SELECT
						fk.oid,
						COALESCE(
							EXISTS (
								SELECT 1 FROM pg_constraint con3
								WHERE con3.conrelid = fk.confrelid
									AND con3.contype = 'p'
									AND con3.conkey = fk.confkey
							),
							false
						) as referenced_is_pk
					FROM fk_info fk
				)
				SELECT
					CASE
						WHEN fk_u.fk_is_unique AND ref_u.referenced_is_pk THEN 'one-to-one'
						WHEN NOT fk_u.fk_is_unique AND ref_u.referenced_is_pk THEN 'many-to-one'
						WHEN fk_u.fk_is_unique AND NOT ref_u.referenced_is_pk THEN 'one-to-many'
						ELSE 'many-to-many'
					END as cardinality
				FROM fk_info fk
				JOIN fk_side_unique fk_u ON fk.oid = fk_u.oid
				JOIN referenced_side_unique ref_u ON fk.oid = ref_u.oid
				LIMIT 1
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
