import { RemoteSqlClient } from "#src/server/db-dialect/remote-database.tag.ts";
import { Effect } from "effect";
import { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import type {
	IDatabaseIntrospector,
	ColumnInfo,
	TableInfo,
	ForeignKeyInfo,
	IndexInfo,
} from "./introspection-interface.ts";

/**
 * PostgreSQL-specific database introspector
 * Uses SQL queries against information_schema for introspection
 */
export const makePostgresIntrospector = (): IDatabaseIntrospector => ({
	getAvailableDatabases: () =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;

			const result = yield* sqlClient<{ datname: string }>`
				SELECT datname
				FROM pg_database
				WHERE datistemplate = false
				ORDER BY datname
			`;

			return result.map((r) => r.datname);
		}),

	getAvailableSchemas: () =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;

			const result = yield* sqlClient<{ schema_name: string }>(sql`
				SELECT schema_name
				FROM information_schema.schemata
				WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
				ORDER BY schema_name
			`);

			return result.map((r) => r.schema_name);
		}),

	getAvailableTables: (schema = "public") =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;

			const result = yield* sqlClient<{
				table_name: string;
				table_type: string;
			}>(sql`
				SELECT table_name, table_type
				FROM information_schema.tables
				WHERE table_schema = ${schema}
				AND table_type IN ('BASE TABLE', 'VIEW', 'MATERIALIZED VIEW')
				ORDER BY table_name
			`);

			return result.map((r) => ({
				name: r.table_name,
				schema,
				type: (r.table_type === "BASE TABLE"
					? "table"
					: r.table_type === "MATERIALIZED VIEW"
						? "materialized_view"
						: "view") as "table" | "view" | "materialized_view",
				isSystem: false,
			}));
		}),

	getTableColumns: (schema, table) =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;
			const connectionId = yield* RemoteConnection;

			// Get foreign key information
			const fkResult = yield* sqlClient<{
				column_name: string;
				referenced_schema: string;
				referenced_table: string;
				referenced_column: string;
				constraint_name: string;
			}>(sql`
				SELECT
					a.attname AS column_name,
					nf.nspname AS referenced_schema,
					cf.relname AS referenced_table,
					af.attname AS referenced_column,
					con.conname AS constraint_name
				FROM
					pg_attribute a
					JOIN pg_class c ON a.attrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
					JOIN pg_constraint con ON con.conrelid = c.oid AND a.attnum = ANY(con.conkey)
					JOIN pg_class cf ON con.confrelid = cf.oid
					JOIN pg_namespace nf ON cf.relnamespace = nf.oid
					JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = ANY(con.confkey)
				WHERE
					n.nspname = ${schema}
					AND c.relname = ${table}
					AND con.contype = 'f'
					AND a.attnum > 0
					AND NOT a.attisdropped
			`).pipe(
				withQueryLogging({
					type: QueryLogType.ColumnMetadata,
					sql: `FK query for ${schema}.${table}`,
					schema,
					table,
					connectionId,
				}),
			);

			const fkMap = new Map(
				fkResult.map((fk) => [
					fk.column_name,
					{
						referenced_schema: fk.referenced_schema,
						referenced_table: fk.referenced_table,
						referenced_column: fk.referenced_column,
						constraint_name: fk.constraint_name,
					},
				]),
			);

			// Get column information
			const colResult = yield* sqlClient<{
				name: string;
				data_type: string;
				nullable: boolean;
				primary_key: boolean;
				is_identity: boolean;
				default_value: string | null;
			}>(sql`
				SELECT DISTINCT ON (a.attnum)
					a.attname as name,
					format_type(a.atttypid, a.atttypmod) as data_type,
					NOT a.attnotnull as nullable,
					(t.contype = 'p') as primary_key,
					a.attidentity != '' as is_identity,
					pg_get_expr(d.adbin, d.adrelid) as default_value
				FROM
					pg_attribute a
					LEFT JOIN pg_constraint t ON a.attrelid = t.conrelid AND a.attnum = ANY(t.conkey) AND t.contype = 'p'
					LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
					JOIN pg_class c ON a.attrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
				WHERE
					n.nspname = ${schema}
					AND c.relname = ${table}
					AND a.attnum > 0
					AND NOT a.attisdropped
				ORDER BY
					a.attnum
			`).pipe(
				withQueryLogging({
					type: QueryLogType.ColumnMetadata,
					sql: `Column query for ${schema}.${table}`,
					schema,
					table,
					connectionId,
				}),
			);

			return colResult.map((col) => ({
				name: col.name,
				type: col.data_type,
				nullable: col.nullable,
				default: col.default_value || undefined,
				isPrimaryKey: col.primary_key,
				isAutoIncrement: col.is_identity,
			})) as ColumnInfo[];
		}),

	getTableForeignKeys: (schema, table) =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;
			const connectionId = yield* RemoteConnection;

			const result = yield* sqlClient<{
				column_name: string;
				referenced_schema: string;
				referenced_table: string;
				referenced_column: string;
				constraint_name: string;
			}>(sql`
				SELECT
					kcu1.column_name,
					kcu2.table_schema AS referenced_schema,
					kcu2.table_name AS referenced_table,
					kcu2.column_name AS referenced_column,
					kcu1.constraint_name
				FROM
					information_schema.key_column_usage kcu1
					LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
					LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
				WHERE
					kcu1.table_schema = ${schema}
					AND kcu1.table_name = ${table}
					AND kcu1.constraint_name IN (
						SELECT constraint_name
						FROM information_schema.table_constraints
						WHERE constraint_type = 'FOREIGN KEY'
							AND table_schema = ${schema}
							AND table_name = ${table}
					)
				ORDER BY
					kcu1.ordinal_position
			`).pipe(
				withQueryLogging({
					type: QueryLogType.ForeignKeyLookup,
					sql: `FK lookup for ${schema}.${table}`,
					schema,
					table,
					connectionId,
				}),
			);

			return result.map((row) => ({
				name: row.constraint_name,
				sourceTable: table,
				sourceColumn: row.column_name,
				referencedTable: row.referenced_table,
				referencedColumn: row.referenced_column,
			})) as ForeignKeyInfo[];
		}),

	getTableIndexes: (schema, table) =>
		Effect.gen(function* () {
			const sqlClient = yield* RemoteSqlClient;
			const connectionId = yield* RemoteConnection;

			const result = yield* sqlClient<{
				indexname: string;
				indexdef: string;
				is_unique: boolean;
				is_primary: boolean;
				columns: string;
			}>(sql`
				SELECT
					i.indexname,
					ix.indexdef,
					ix.indexdef LIKE '%UNIQUE%' as is_unique,
					ix.indexdef LIKE '%PRIMARY%' as is_primary,
					array_agg(a.attname ORDER BY a.attnum) as columns
				FROM
					pg_indexes ix
					JOIN pg_index pi ON (ix.schemaname, ix.tablename, ix.indexname) = (pi.schemaname::text, pi.tablename::text, pi.indexrelname::text)
					JOIN pg_attribute a ON a.attrelid = pi.indrelid
					JOIN pg_indexes i ON i.indexname = ix.indexname
				WHERE
					ix.schemaname = ${schema}
					AND ix.tablename = ${table}
				GROUP BY
					i.indexname, ix.indexdef
			`).pipe(
				withQueryLogging({
					type: QueryLogType.ColumnMetadata,
					sql: `Indexes for ${schema}.${table}`,
					schema,
					table,
					connectionId,
				}),
			);

			return result.map((row) => ({
				name: row.indexname,
				isUnique: row.is_unique,
				isPrimaryKey: row.is_primary,
				columns: row.columns ? row.columns.split(",") : [],
			})) as IndexInfo[];
		}),
});
