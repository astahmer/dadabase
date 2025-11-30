import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import {
	persistQueryLog,
	updatePersistedQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

/**
 * Get all relationships for a table (both incoming and outgoing)
 * Returns a single result set with all relationships efficiently fetched
 */
export const getTableRelationships = (input: {
	schema: string;
	table: string;
	connectionId?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			const relQuery = sql<TableRelationship>`
				-- Get outgoing relationships (FKs from this table)
				SELECT
					'outgoing'::text as type,
					${input.schema}::text as "referencingSchema",
					${input.table}::text as "referencingTable",
					a.attname::text as "referencingColumn",
					nf.nspname::text as "referencedSchema",
					cf.relname::text as "referencedTable",
					af.attname::text as "referencedColumn",
					con.conname::text as "constraintName"
				FROM
					pg_attribute a
					JOIN pg_class c ON a.attrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
					JOIN pg_constraint con ON con.conrelid = c.oid AND a.attnum = ANY(con.conkey)
					JOIN pg_class cf ON con.confrelid = cf.oid
					JOIN pg_namespace nf ON cf.relnamespace = nf.oid
					JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = ANY(con.confkey)
				WHERE
					n.nspname = ${input.schema}
					AND c.relname = ${input.table}
					AND con.contype = 'f'
					AND a.attnum > 0
					AND NOT a.attisdropped

				UNION ALL

				-- Get incoming relationships (FKs pointing to this table)
				SELECT
					'incoming'::text as type,
					kcu1.table_schema::text as "referencingSchema",
					kcu1.table_name::text as "referencingTable",
					kcu1.column_name::text as "referencingColumn",
					${input.schema}::text as "referencedSchema",
					${input.table}::text as "referencedTable",
					kcu2.column_name::text as "referencedColumn",
					kcu1.constraint_name::text as "constraintName"
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
					AND kcu2.table_schema = ${input.schema}
					AND kcu2.table_name = ${input.table}
			ORDER BY
				type, "referencingTable", "referencingColumn"
		`;

			const compiledRel = relQuery.compile(db);
			const relationships = yield* db.execute(relQuery).pipe(
				withQueryLogging({
					type: "constraint" as const,
					sql: compiledRel.sql,
					params: compiledRel.parameters,
					schema: input.schema,
					table: input.table,
					connectionId: input.connectionId,
					persistFn: persistQueryLog,
					updatePersistFn: updatePersistedQueryLog,
				}),
			);
			return relationships;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't get relationships for table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
