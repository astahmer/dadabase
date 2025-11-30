import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

/**
 * Multi-dialect introspection functions using @effect/sql with onDialectOrElse.
 * No abstraction layer needed—dialect-specific SQL is handled directly by SqlClient.
 *
 * Each function uses client.onDialectOrElse({ pg: ..., sqlite: ..., orElse: ... })
 * to branch SQL by database dialect at query time.
 */

/**
 * Get available databases for the connected database
 * - PostgreSQL: Query pg_catalog.pg_database
 * - SQLite: Returns the attached databases
 */
export const getAvailableDatabases = () =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		const result = yield* client.onDialectOrElse({
			pg: () =>
				client<{ datname: string }>`
					SELECT datname FROM pg_catalog.pg_database ORDER BY datname
				`,
			sqlite: () =>
				client<{ name: string }>`
					PRAGMA database_list
				`,
			orElse: () =>
				client<{ datname: string }>`
					SELECT datname FROM pg_catalog.pg_database ORDER BY datname
				`,
		});

		return result.map((row) =>
			"datname" in row ? row.datname : "name" in row ? row.name : "",
		);
	});

/**
 * Get available schemas for the connected database
 * - PostgreSQL: Query information_schema.schemata
 * - SQLite: Returns 'main' and 'temp' schemas
 */
export const getAvailableSchemas = () =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		const result = yield* client.onDialectOrElse({
			pg: () =>
				client<{ schema_name: string }>`
					SELECT schema_name FROM information_schema.schemata
					WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
					ORDER BY schema_name
				`,
			sqlite: () =>
				client<{ schema_name: string }>`
					SELECT 'main' as schema_name
					UNION SELECT 'temp' as schema_name
				`,
			orElse: () =>
				client<{ schema_name: string }>`
					SELECT schema_name FROM information_schema.schemata
					ORDER BY schema_name
				`,
		});

		return result.map((row) => row.schema_name);
	});

/**
 * Get available tables in a schema
 * - PostgreSQL: Query information_schema.tables
 * - SQLite: Query sqlite_master
 */
export const getAvailableTables = (input: { schema: string }) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;
		const { schema } = input;

		const result = yield* client.onDialectOrElse({
			pg: () =>
				client<{ table_name: string }>`
					SELECT table_name FROM information_schema.tables
					WHERE table_schema = ${schema}
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`,
			sqlite: () =>
				client<{ table_name: string }>`
					SELECT name as table_name FROM sqlite_master
					WHERE type = 'table'
					AND name NOT LIKE 'sqlite_%'
					ORDER BY table_name
				`,
			orElse: () =>
				client<{ table_name: string }>`
					SELECT table_name FROM information_schema.tables
					WHERE table_schema = ${schema}
					ORDER BY table_name
				`,
		});

		return result.map((row) => row.table_name);
	});

interface ColumnInfo {
	column_name: string;
	data_type: string;
	is_nullable: boolean;
	column_default: string | null;
	ordinal_position: number;
}

interface PragmaColumnInfo {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
}

/**
 * Get columns for a table
 * - PostgreSQL: Query information_schema.columns
 * - SQLite: PRAGMA table_info
 */
export const getTableColumns = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		return yield* client.onDialectOrElse({
			pg: () =>
				client<ColumnInfo>`
					SELECT
						c.column_name,
						c.data_type,
						c.is_nullable = 'YES' as is_nullable,
						c.column_default,
						c.ordinal_position
					FROM information_schema.columns c
					WHERE c.table_schema = ${schema}
					AND c.table_name = ${table}
					ORDER BY c.ordinal_position
				`,
			sqlite: () =>
				Effect.gen(function* () {
					const rows = yield* client<PragmaColumnInfo>`
						PRAGMA table_info(${table})
					`;
					return rows.map((row) => ({
						column_name: row.name,
						data_type: row.type,
						is_nullable: row.notnull === 0,
						column_default: row.dflt_value,
						ordinal_position: row.cid,
					})) as ColumnInfo[];
				}),
			orElse: () =>
				client<ColumnInfo>`
					SELECT
						column_name,
						data_type,
						is_nullable = 'YES' as is_nullable,
						column_default,
						ordinal_position
					FROM information_schema.columns
					WHERE table_schema = ${schema}
					AND table_name = ${table}
					ORDER BY ordinal_position
				`,
		});
	});

interface ForeignKeyInfo {
	constraint_name: string;
	column_name: string;
	referenced_table_schema: string;
	referenced_table_name: string;
	referenced_column_name: string;
}

interface PragmaForeignKeyInfo {
	id: number;
	seq: number;
	table: string;
	from: string;
	to: string;
	on_delete: string;
	on_update: string;
	match: string;
}

/**
 * Get foreign keys for a table
 * - PostgreSQL: Query information_schema.table_constraints
 * - SQLite: PRAGMA foreign_key_list
 */
export const getTableForeignKeys = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		return yield* client.onDialectOrElse({
			pg: () =>
				client<ForeignKeyInfo>`
					SELECT
						tc.constraint_name,
						kcu.column_name,
						ccu.table_schema as referenced_table_schema,
						ccu.table_name as referenced_table_name,
						ccu.column_name as referenced_column_name
					FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage kcu
						ON tc.constraint_name = kcu.constraint_name
					JOIN information_schema.constraint_column_usage ccu
						ON tc.constraint_name = ccu.constraint_name
					WHERE tc.constraint_type = 'FOREIGN KEY'
					AND tc.table_schema = ${schema}
					AND tc.table_name = ${table}
				`,
			sqlite: () =>
				Effect.gen(function* () {
					const rows = yield* client<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${table})
					`;
					return rows.map((row) => ({
						constraint_name: `fk_${row.id}`,
						column_name: row.from,
						referenced_table_schema: "",
						referenced_table_name: row.table,
						referenced_column_name: row.to,
					})) as ForeignKeyInfo[];
				}),
			orElse: () =>
				client<ForeignKeyInfo>`
					SELECT constraint_name, column_name FROM information_schema.key_column_usage
					WHERE table_schema = ${schema} AND table_name = ${table}
				`,
		});
	});

interface IndexInfo {
	index_name: string;
	column_name: string;
	is_unique: boolean;
	is_primary: boolean;
}

interface PragmaIndexInfo {
	seq: number;
	name: string;
	unique: number;
	partial: number;
}

/**
 * Get indexes for a table
 * - PostgreSQL: Query pg_indexes
 * - SQLite: PRAGMA index_list
 */
export const getTableIndexes = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		return yield* client.onDialectOrElse({
			pg: () =>
				client<IndexInfo>`
					SELECT DISTINCT
						pi.indexname as index_name,
						a.attname as column_name,
						ix.indisunique as is_unique,
						ix.indisprimary as is_primary
					FROM pg_indexes pi
					JOIN pg_class t ON pi.tablename = t.relname
					JOIN pg_class c ON pi.indexname = c.relname
					JOIN pg_index ix ON c.oid = ix.indexrelid
					JOIN pg_attribute a ON a.attrelid = t.oid
						AND a.attnum = ANY(ix.indkey)
					WHERE pi.schemaname = ${schema}
					AND pi.tablename = ${table}
				`,
			sqlite: () =>
				Effect.gen(function* () {
					const rows = yield* client<PragmaIndexInfo>`
						PRAGMA index_list(${table})
					`;
					return rows.map((row) => ({
						index_name: row.name,
						column_name: "",
						is_unique: row.unique === 1,
						is_primary: false,
					})) as IndexInfo[];
				}),
			orElse: () =>
				client<IndexInfo>`
					SELECT index_name, column_name FROM information_schema.statistics
					WHERE table_schema = ${schema} AND table_name = ${table}
				`,
		});
	});
