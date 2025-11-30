import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";
import { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import {
	persistQueryLog,
	updatePersistedQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

export interface ForeignKeyInfo {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	constraintName: string;
}

export interface TableColumnMetadata {
	name: string;
	dataType: string;
	nullable: boolean;
	primaryKey: boolean;
	unique: boolean;
	defaultValue: string | null;
	isForeignKey?: boolean;
	foreignKey?: ForeignKeyInfo;
}

export const getTableColumns = (input: {
	schema: string;
	table: string;
	connectionId?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		try {
			// First, get all foreign keys for this table using a simpler query
			const fkQuery = sql<{
				columnName: string;
				referencedSchema: string;
				referencedTable: string;
				referencedColumn: string;
				constraintName: string;
			}>`
				SELECT
					a.attname AS "columnName",
					nf.nspname AS "referencedSchema",
					cf.relname AS "referencedTable",
					af.attname AS "referencedColumn",
					con.conname AS "constraintName"
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
			`;

			const compiledFk = fkQuery.compile(db);
			const foreignKeys = yield* db.execute(fkQuery).pipe(
				withQueryLogging({
					type: QueryLogType.ColumnMetadata,
					sql: compiledFk.sql,
					params: compiledFk.parameters,
					schema: input.schema,
					table: input.table,
					connectionId: input.connectionId,
				}),
			); // Create a map for quick FK lookup
			const fkMap = new Map<
				string,
				{
					referencedSchema: string;
					referencedTable: string;
					referencedColumn: string;
					constraintName: string;
				}
			>();
			foreignKeys.forEach((fk) => {
				fkMap.set(fk.columnName, {
					referencedSchema: fk.referencedSchema,
					referencedTable: fk.referencedTable,
					referencedColumn: fk.referencedColumn,
					constraintName: fk.constraintName,
				});
			});

			const columnsQuery = sql<TableColumnMetadata>`
			SELECT DISTINCT ON (a.attnum)
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
				AND c.relname = ${input.table}
				AND a.attnum > 0
				AND NOT a.attisdropped
			ORDER BY
				a.attnum
		`;

			const compiledCols = columnsQuery.compile(db);
			const columns = yield* db.execute(columnsQuery).pipe(
				withQueryLogging({
					type: QueryLogType.ColumnMetadata,
					sql: compiledCols.sql,
					params: compiledCols.parameters,
					schema: input.schema,
					table: input.table,
					connectionId: input.connectionId,
				}),
			); // Merge FK info with column metadata
			return columns.map((col) => ({
				...col,
				isForeignKey: fkMap.has(col.name),
				foreignKey: fkMap.get(col.name),
			}));
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't get columns for table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
