import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { Cache, Duration, Effect } from "effect";
import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import {
	buildPgWhereFragment,
	buildSqliteWhereFragment,
} from "./build-where.ts";
import type { TableRelationshipInput } from "./connection-adapter.ts";
import {
	buildJoinSqlClauses,
	buildPgJoinFilters,
	buildPgSelectWithJoins,
	buildSqliteJoinFilters,
	buildSqliteSelectWithJoins,
	generateJoinAliases,
} from "./join-builder.ts";

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
		const sql = yield* SqlClient.SqlClient;

		const result = yield* sql.onDialectOrElse({
			pg: () =>
				sql<{ datname: string }>`
					SELECT datname as name FROM pg_catalog.pg_database ORDER BY datname
				`,
			sqlite: () =>
				sql<{ name: string }>`
					PRAGMA database_list
				`,
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result as Array<{ name: string }>;
	});

/**
 * Get available schemas for the connected database
 * - PostgreSQL: Query information_schema.schemata
 * - SQLite: Returns 'main' and 'temp' schemas
 */
export const getAvailableSchemas = () =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const result = yield* sql.onDialectOrElse({
			pg: () =>
				sql<{ schema_name: string }>`
					SELECT schema_name FROM information_schema.schemata
					WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
					ORDER BY schema_name
				`,
			sqlite: () =>
				sql<{ schema_name: string }>`
					SELECT 'main' as schema_name
					UNION SELECT 'temp' as schema_name
				`,
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result.map((row) => row.schema_name);
	});

/**
 * Get available tables in a schema
 * - PostgreSQL: Query information_schema.tables
 * - SQLite: Query sqlite_master
 */
export const getAvailableTables = (input?: { schema?: string }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const result = yield* sql.onDialectOrElse({
			pg: () => {
				const query = sql`
					SELECT table_name as name, table_schema as schema FROM information_schema.tables
					WHERE table_schema = ${input?.schema || getDialectDefaultSchema(DatabaseDialect.Postgres)}
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`;
				return query;
			},
			sqlite: () =>
				sql`
					SELECT name as name FROM sqlite_master
					WHERE type = 'table'
					AND name NOT LIKE 'sqlite_%'
					ORDER BY name
				`,
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result as Array<{ name: string; schema: string }>;
	});

export interface ColumnInfo {
	column_name: string;
	data_type: string;
	is_nullable: boolean;
	column_default: string | null;
	ordinal_position: number;
}

/**
 * Get columns for a table
 * - PostgreSQL: Query information_schema.columns
 * - SQLite: PRAGMA table_info
 */
export const getTableColumns = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const output = yield* sql.onDialectOrElse({
			pg: () =>
				Effect.gen(function* () {
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

					// const [templateSql, parameters] = fkQuery.compile();
					// const compiled = fkQuery.compile();
					const foreignKeys = yield* fkQuery;
					// pipe(
					// 	withQueryLogging({
					// 		type: QueryLogType.ColumnMetadata,
					// 		sql: compiled[0],
					// 		params: compiled[1],
					// 		schema: input.schema,
					// 		table: input.table,
					// 		connectionId: input.connectionId,
					// 	}),
					// );
					// Create a map for quick FK lookup
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

					// const compiledCols = columnsQuery.compile(db);
					const columns = yield* columnsQuery;
					// .pipe(
					// 	withQueryLogging({
					// 		type: QueryLogType.ColumnMetadata,
					// 		sql: compiledCols.sql,
					// 		params: compiledCols.parameters,
					// 		schema: input.schema,
					// 		table: input.table,
					// 		connectionId: input.connectionId,
					// 	}),
					// );
					// Merge FK info with column metadata
					return columns.map((col) => ({
						...col,
						isForeignKey: fkMap.has(col.name),
						foreignKey: fkMap.get(col.name),
					}));
				}),
			sqlite: () =>
				Effect.gen(function* () {
					// Get table schema from PRAGMA table_info
					const tableInfo = yield* sql<{
						cid: number;
						name: string;
						type: string;
						notnull: number;
						dflt_value: string | null;
						pk: number;
					}>`PRAGMA table_info(${sql(input.table)})`;

					// Get foreign keys for this table
					const fks =
						yield* sql<PragmaForeignKeyInfo>`PRAGMA foreign_key_list(${sql(input.table)})`;

					// Create FK map for quick lookup
					const fkMap = new Map<
						string,
						{
							referencedSchema: string;
							referencedTable: string;
							referencedColumn: string;
							constraintName: string;
						}
					>();

					fks.forEach((fk) => {
						fkMap.set(fk.from, {
							referencedSchema: "", // SQLite doesn't have schemas
							referencedTable: fk.table,
							referencedColumn: fk.to,
							constraintName: `fk_${fk.id}`,
						});
					});

					// Convert PRAGMA table_info to our TableColumnMetadata format
					return tableInfo.map((col) => ({
						name: col.name,
						dataType: col.type.toLowerCase(), // Normalize to lowercase like PostgreSQL
						nullable: col.notnull === 0,
						primaryKey: col.pk > 0,
						unique: false, // Would need to check indexes for unique columns
						defaultValue: col.dflt_value,
						isForeignKey: fkMap.has(col.name),
						foreignKey: fkMap.get(col.name),
					}));
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});
		return output as Array<TableColumnMetadata>;
	});

export interface ForeignKeyInfo {
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
		const sql = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		const result = yield* sql.onDialectOrElse({
			pg: () =>
				sql<ForeignKeyInfo>`
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
					const rows = yield* sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${sql(table)})
					`;

					// Get column positions for ordering
					const tableInfo = yield* sql<{
						cid: number;
						name: string;
					}>`
						PRAGMA table_info(${sql(table)})
					`;

					const columnPositions = new Map(
						tableInfo.map((col) => [col.name, col.cid]),
					);

					return rows
						.map((row) => ({
							constraint_name: `fk_${row.id}`,
							column_name: row.from,
							referenced_table_schema: input.schema,
							referenced_table_name: row.table,
							referenced_column_name: row.to,
						}))
						.sort((a, b) => {
							const posA = columnPositions.get(a.column_name) ?? 999;
							const posB = columnPositions.get(b.column_name) ?? 999;
							return posA - posB;
						}) as ForeignKeyInfo[];
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result as Array<ForeignKeyInfo>;
	});

export interface IndexInfo {
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
	origin?: string;
}

/**
 * Get indexes for a table
 * - PostgreSQL: Query pg_indexes
 * - SQLite: PRAGMA index_list
 */
export const getTableIndexes = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		const result = yield* sql.onDialectOrElse({
			pg: () =>
				sql<IndexInfo>`
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
					const indexList = yield* sql<PragmaIndexInfo>`
						PRAGMA index_list(${sql(table)})
					`;

					const results: IndexInfo[] = [];

					for (const idx of indexList) {
						// For each index, get its columns
						const idxCols = yield* sql<{
							seqno: number;
							cid: number;
							name: string;
						}>`
							PRAGMA index_info(${sql(idx.name)})
						`;

						for (const col of idxCols) {
							results.push({
								index_name: idx.name,
								column_name: col.name,
								is_unique: idx.unique === 1,
								is_primary:
									idx.origin === "pk" ||
									idx.name.startsWith("sqlite_autoindex"),
							});
						}
					}

					return results as IndexInfo[];
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result as Array<IndexInfo>;
	});

/**
 * Types and helper used by getAllTablesColumns
 */
export interface AllTablesForeignKeyInfo {
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
	foreignKey?: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
		constraintName: string;
	};
}

export interface TableWithColumnsMetadata {
	table: string;
	columns: Array<TableColumnMetadata>;
}

/**
 * Get all tables and their columns (including basic FK mapping)
 * Reuses existing multi-dialect helpers `getAvailableTables`, `getTableColumns`,
 * and `getTableForeignKeys` so logic stays consistent across drivers.
 */
export const getAllTablesColumns = (input: { schema: string }) =>
	Effect.gen(function* () {
		const { schema } = input;

		const tables = yield* getAvailableTables({ schema });

		// For each table, fetch columns and foreign keys and merge them
		const tablesWithColumns = yield* Effect.all(
			tables.map((table) =>
				Effect.gen(function* () {
					const [cols, fks, indexes] = yield* Effect.all(
						[
							getTableColumns({ schema, table: table.name }),
							getTableForeignKeys({ schema, table: table.name }),
							getTableIndexes({ schema, table: table.name }),
						],
						{ concurrency: "unbounded" },
					);

					// Build FK map keyed by column_name (getTableForeignKeys returns snake_case keys)
					const fkMap = new Map<string, AllTablesForeignKeyInfo>();
					for (const fk of fks) {
						fkMap.set(fk.column_name, {
							referencedSchema: (fk.referenced_table_schema ??
								fk.referenced_table_schema) as string,
							referencedTable: fk.referenced_table_name as string,
							referencedColumn: fk.referenced_column_name as string,
							constraintName: fk.constraint_name as string,
						});
					}

					// Build sets for primary key and unique columns from indexes (PG) or column info (SQLite)
					const pkSet = new Set<string>();
					const uniqueSet = new Set<string>();

					// Indexes may contain multiple entries per index (one per column)
					for (const idx of indexes as IndexInfo[]) {
						if (idx.is_primary) pkSet.add(idx.column_name);
						if (idx.is_unique) uniqueSet.add(idx.column_name);
					}

					// For sqlite, PRAGMA table_info provides pk flag on columns; ensure we include those
					for (const c of cols) {
						if (c.primaryKey) pkSet.add(c.name);
					}
					const columns = cols.map((c) => ({
						name: c.name,
						dataType: c.dataType,
						nullable: Boolean(c.nullable),
						primaryKey: pkSet.has(c.name) || false,
						unique: uniqueSet.has(c.name) || false,
						defaultValue: c.defaultValue ?? null,
						isForeignKey: fkMap.has(c.name),
						foreignKey: fkMap.has(c.name) ? fkMap.get(c.name) : undefined,
					}));

					return {
						table: table.name,
						columns,
					} as TableWithColumnsMetadata;
				}),
			),
			{ concurrency: "unbounded" },
		);

		return tablesWithColumns;
	});

/**
 * Get all relationships for a table (both incoming and outgoing)
 * - PostgreSQL: Query pg_constraint and information_schema
 * - SQLite: PRAGMA foreign_key_list (limited - only outgoing)
 */
export const getTableRelationships = (input: {
	schema: string;
	table: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		const output = yield* sql.onDialectOrElse({
			pg: () =>
				sql<TableRelationship>`
					-- Get outgoing relationships (FKs from this table)
					SELECT
						'outgoing'::text as type,
						${schema}::text as "referencingSchema",
						${table}::text as "referencingTable",
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
						n.nspname = ${schema}
						AND c.relname = ${table}
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
						${schema}::text as "referencedSchema",
						${table}::text as "referencedTable",
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
						AND kcu2.table_schema = ${schema}
						AND kcu2.table_name = ${table}
					ORDER BY
						type, "referencingTable", "referencingColumn"
				`,
			sqlite: () =>
				Effect.gen(function* () {
					// Get outgoing relationships via PRAGMA
					const outgoingRows = yield* sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${sql(table)})
					`;

					const outgoing = outgoingRows.map((row) => ({
						type: "outgoing" as const,
						referencingSchema: schema,
						referencingTable: table,
						referencingColumn: row.from,
						referencedSchema: schema,
						referencedTable: row.table,
						referencedColumn: row.to,
						constraintName: `fk_${row.id}`,
					}));

					// Get incoming relationships by finding all FK references to this table
					// For each column in this table, find tables that reference it
					const tableInfo = yield* sql<{
						name: string;
					}>`
						PRAGMA table_info(${sql(table)})
					`;

					const incomingRelationships: TableRelationship[] = [];
					for (const col of tableInfo) {
						const refs = yield* findColumnReferences({
							referencedSchema: schema,
							referencedTable: table,
							referencedColumn: col.name,
						});

						for (const ref of refs) {
							incomingRelationships.push({
								type: "incoming" as const,
								referencingSchema: ref.schema,
								referencingTable: ref.table,
								referencingColumn: ref.column,
								referencedSchema: schema,
								referencedTable: table,
								referencedColumn: ref.referencedColumn,
								constraintName: ref.constraintName,
							});
						}
					}

					// Combine and sort
					const combined = [...outgoing, ...incomingRelationships].sort(
						(a, b) => {
							const typeOrder = { outgoing: 0, incoming: 1 };
							if (typeOrder[a.type] !== typeOrder[b.type]) {
								return typeOrder[a.type] - typeOrder[b.type];
							}
							if (a.referencingTable !== b.referencingTable) {
								return a.referencingTable.localeCompare(b.referencingTable);
							}
							return a.referencingColumn.localeCompare(b.referencingColumn);
						},
					);

					return combined;
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return output as Array<TableRelationship>;
	});

/**
 * Column reference info for reverse FK lookup
 */
export interface ColumnReference {
	schema: string;
	table: string;
	column: string;
	referencedColumn: string;
	constraintName: string;
}

/**
 * Get all tables and columns that reference a specific column (reverse FK lookup)
 * - PostgreSQL: Query information_schema
 * - SQLite: Not directly supported (would need to scan all tables)
 */
export const findColumnReferences = (input: {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { referencedSchema, referencedTable, referencedColumn } = input;

		const output = yield* sql.onDialectOrElse({
			pg: () =>
				sql`
					SELECT
						kcu1.table_schema AS schema,
						kcu1.table_name AS table,
						kcu1.column_name AS column,
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
						AND kcu2.table_schema = ${referencedSchema}
						AND kcu2.table_name = ${referencedTable}
						AND kcu2.column_name = ${referencedColumn}
					ORDER BY
						kcu1.table_name,
						kcu1.column_name
				`,
			sqlite: () =>
				Effect.gen(function* () {
					// SQLite: manually scan all tables for foreign keys that reference the target
					const tables = yield* getAvailableTables();
					const results: ColumnReference[] = [];

					for (const tableInfo of tables) {
						const fks = yield* getTableForeignKeys({
							schema: referencedSchema,
							table: tableInfo.name,
						});

						for (const fk of fks) {
							if (
								fk.referenced_table_name === referencedTable &&
								fk.referenced_column_name === referencedColumn
							) {
								results.push({
									schema: referencedSchema,
									table: tableInfo.name,
									column: fk.column_name,
									referencedColumn: fk.referenced_column_name,
									constraintName: fk.constraint_name,
								});
							}
						}
					}

					return results.sort((a, b) => {
						if (a.table !== b.table) {
							return a.table.localeCompare(b.table);
						}
						return a.column.localeCompare(b.column);
					});
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return output as Array<ColumnReference>;
	});

export interface ColumnReferenceWithCount extends ColumnReference {
	matchingRowCount: number;
}

/**
 * Get all tables and columns that reference a specific column with row counts
 * Counts how many rows in each referencing table match the given cell value
 * All COUNT queries execute in parallel for efficiency
 * - PostgreSQL: Query information_schema + dynamic count queries
 * - SQLite: Not directly supported (would need to scan all tables)
 */
export const findColumnReferencesWithCounts = (input: {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	cellValue: unknown;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { referencedSchema, referencedTable, referencedColumn, cellValue } =
			input;

		// First get all references
		const references = yield* findColumnReferences({
			referencedSchema,
			referencedTable,
			referencedColumn,
		});

		// Normalize the cell value: treat string "null" or "undefined" as null
		const normalizedCellValue =
			cellValue === undefined || cellValue === null
				? null
				: typeof cellValue === "string" &&
						(cellValue === "null" || cellValue === "undefined")
					? null
					: cellValue;

		// Execute all COUNT queries in parallel
		const referencesWithCounts = yield* Effect.all(
			references.map((ref) => {
				const tableRef = sql`${sql(ref.schema)}.${sql(ref.table)}`;
				const column = sql(ref.column);
				return sql.onDialectOrElse({
					pg: () => {
						// Build the count query based on whether value is null
						if (normalizedCellValue === null) {
							return sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${tableRef}
								WHERE ${column} IS NULL
							`.pipe(
								Effect.map((rows) => ({
									...ref,
									matchingRowCount: Number(rows[0]?.count ?? 0),
								})),
								Effect.catchAll(() =>
									Effect.succeed({
										...ref,
										matchingRowCount: -1,
									}),
								),
							);
						}
						return sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${tableRef}
							WHERE ${column} = ${normalizedCellValue}
						`.pipe(
							Effect.map((rows) => ({
								...ref,
								matchingRowCount: Number(rows[0]?.count ?? 0),
							})),
							Effect.catchAll(() =>
								Effect.succeed({
									...ref,
									matchingRowCount: -1,
								}),
							),
						);
					},
					sqlite: () => {
						// SQLite: execute the count query dynamically
						if (normalizedCellValue === null) {
							return sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${sql(ref.table)}
								WHERE ${sql(ref.column)} IS NULL
							`.pipe(
								Effect.map((rows) => ({
									...ref,
									matchingRowCount: Number(rows[0]?.count ?? 0),
								})),
								Effect.catchAll(() =>
									Effect.succeed({
										...ref,
										matchingRowCount: -1,
									}),
								),
							);
						}
						return sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${sql(ref.table)}
							WHERE ${sql(ref.column)} = ${normalizedCellValue}
						`.pipe(
							Effect.map((rows) => ({
								...ref,
								matchingRowCount: Number(rows[0]?.count ?? 0),
							})),
							Effect.catchAll(() =>
								Effect.succeed({
									...ref,
									matchingRowCount: -1,
								}),
							),
						);
					},
					orElse: () => new SqlError({ cause: "Unsupported dialect" }),
				});
			}),
		);

		return referencesWithCounts;
	});

export type RelationshipCardinality =
	| "one-to-one"
	| "one-to-many"
	| "many-to-one"
	| "many-to-many";

/**
 * Detect the cardinality of a foreign key relationship.
 * - PostgreSQL: Query pg_constraint to check uniqueness
 * - SQLite: Limited support (always returns many-to-one as default)
 *
 * Checks:
 * 1. If the referencing columns have a UNIQUE/PRIMARY KEY constraint → potentially 1:1
 * 2. If the referenced columns are unique (PK of referenced table) → indicates 1:N or 1:1
 * 3. If neither side is unique → M:N (many-to-many)
 *
 * @param isIncomingRelationship - When true, inverts the cardinality perspective
 *   (many-to-one becomes one-to-many and vice versa)
 */
export const getRelationshipCardinality = (input: {
	schema: string;
	table: string;
	columns: string[];
	isIncomingRelationship?: boolean;
}): Effect.Effect<RelationshipCardinality, SqlError, SqlClient.SqlClient> =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { schema, table, columns, isIncomingRelationship } = input;

		const output = yield* sql.onDialectOrElse({
			pg: () =>
				sql<{ cardinality: string }>`
					-- Determine cardinality of FK relationship
					WITH table_oid AS (
						SELECT oid
						FROM pg_class
						WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ${schema})
							AND relname = ${table}
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
							AND con.contype = 'f'
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
				`,
			sqlite: () =>
				Effect.gen(function* () {
					// Get foreign keys for this table
					const fks = yield* sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list("${table}")
					`;

					// Find the FK that matches our columns
					const matchingFk = fks.find((fk) => fk.from === columns[0]);

					if (!matchingFk) {
						// No matching FK found
						return [{ cardinality: "many-to-one" }];
					}

					// Get table info to check if FK column is a primary key
					const tableInfo = yield* sql<{
						cid: number;
						name: string;
						type: string;
						notnull: number;
						dflt_value: string | null;
						pk: number;
					}>`
						PRAGMA table_info("${table}")
					`;

					// Check if FK column is the primary key
					const fkColumnInfo = tableInfo.find((col) => col.name === columns[0]);
					const fkIsPrimaryKey = (fkColumnInfo?.pk ?? 0) > 0;

					// Get indexes to check if FK columns are unique (non-primary unique index)
					const indexList = yield* sql<PragmaIndexInfo>`
						PRAGMA index_list("${table}")
					`;

					let fkIsUnique = fkIsPrimaryKey; // Primary key is unique

					if (!fkIsUnique) {
						for (const idx of indexList) {
							if (idx.unique === 1 && idx.origin !== "pk") {
								// Check if it's not the primary key index
								const idxCols = yield* sql<{
									seqno: number;
									cid: number;
									name: string;
								}>`
									PRAGMA index_info("${idx.name}")
								`;

								// Check if this index contains our FK column
								if (idxCols.some((col) => col.name === columns[0])) {
									fkIsUnique = true;
									break;
								}
							}
						}
					}

					// Check if referenced columns are the primary key
					const referencedTableInfo = yield* sql<{
						cid: number;
						name: string;
						type: string;
						notnull: number;
						dflt_value: string | null;
						pk: number;
					}>`
						PRAGMA table_info("${matchingFk.table}")
					`;

					const referencedIsPk = referencedTableInfo.some(
						(col) => col.name === matchingFk.to && col.pk > 0,
					);

					let cardinality: string = "many-to-one";
					if (fkIsUnique && referencedIsPk) {
						cardinality = "one-to-one";
					} else if (!fkIsUnique && referencedIsPk) {
						cardinality = "many-to-one";
					} else if (fkIsUnique && !referencedIsPk) {
						cardinality = "one-to-many";
					} else {
						cardinality = "many-to-many";
					}

					return [{ cardinality }];
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});
		const result = output as Array<{ cardinality: string }>;

		// If no result found, return defaults based on relationship direction
		if (result.length === 0) {
			if (isIncomingRelationship) {
				return "one-to-many";
			}
			return "many-to-one";
		}

		let cardinality = result[0].cardinality as RelationshipCardinality;

		// If this is an incoming relationship, invert the cardinality
		// many-to-one becomes one-to-many and vice versa
		if (isIncomingRelationship) {
			if (cardinality === "many-to-one") {
				cardinality = "one-to-many";
			} else if (cardinality === "one-to-many") {
				cardinality = "many-to-one";
			}
			// one-to-one and many-to-many remain the same
		}

		return cardinality;
	});

/**
 * Fetch row counts for all relationships of a table in a single batch
 * This is more efficient than querying each relationship individually
 * - PostgreSQL: Query with COUNT and WHERE clause
 * - SQLite: Same approach
 */
export const getRelationshipsCounts = (input: {
	schema: string;
	table: string;
	relationships: TableRelationshipInput[];
	rowData: Record<string, unknown>;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { relationships, rowData } = input;

		if (relationships.length === 0) {
			return {};
		}

		// Filter out relationships where the FK value is null
		const validRelationships = relationships.filter((rel) => {
			const filterValue =
				rowData[
					rel.type === "incoming" ? rel.referencedColumn : rel.referencingColumn
				];
			const isNullValue =
				filterValue === null ||
				filterValue === undefined ||
				filterValue === "null";
			return !isNullValue;
		});

		// Execute COUNT queries in parallel
		const results = yield* Effect.all(
			validRelationships.map((rel) =>
				Effect.gen(function* () {
					const filterValue =
						rowData[
							rel.type === "incoming"
								? rel.referencedColumn
								: rel.referencingColumn
						];
					const tableRef = sql`${sql(rel.referencingSchema)}.${sql(rel.referencingTable)}`;
					const referencingColumn = sql(rel.referencingColumn);
					const referencingTable = sql(rel.referencingTable);

					const count = yield* sql.onDialectOrElse({
						pg: () =>
							sql<{ count: number }>`
								SELECT COUNT(*)::bigint as count
								FROM ${tableRef}
								WHERE ${referencingColumn} = ${String(filterValue)}
							`.pipe(
								Effect.map((rows) => Number(rows[0]?.count ?? 0)),
								Effect.catchAll(() => Effect.succeed(0)),
							),
						sqlite: () =>
							sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${referencingTable}
								WHERE ${referencingColumn} = ${String(filterValue)}
							`.pipe(
								Effect.map((rows) => Number(rows[0]?.count ?? 0)),
								Effect.catchAll(() => Effect.succeed(0)),
							),
						orElse: () => new SqlError({ cause: "Unsupported dialect" }),
					});

					return {
						constraintName: rel.constraintName,
						count,
					};
				}),
			),
		);

		// Convert array to object keyed by constraintName
		const result: Record<string, number> = {};
		for (const { constraintName, count } of results) {
			result[constraintName] = count;
		}

		return result;
	});

/**
 * Filter condition for building WHERE clauses
 */
export interface FilterCondition {
	column: string;
	operator:
		| "equals"
		| "not_equals"
		| "contains"
		| "not_contains"
		| "starts_with"
		| "ends_with"
		| "greater_than"
		| "greater_than_or_equal"
		| "less_than"
		| "less_than_or_equal"
		| "is_null"
		| "is_not_null"
		| "in"
		| "not_in";
	value?: string | number | boolean | null | string[];
}

/**
 * Query table rows with filtering, pagination, ordering, and joins
 * - PostgreSQL: Uses schema.table notation, ILIKE, ANY/ALL for arrays
 * - SQLite: Uses table only (no schema), LIKE with COLLATE NOCASE, IN for arrays
 */
export const queryTableRows = <TData>(input: {
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: QueryFilterType;
	joins?: JoinTablesConfig["joins"];
}): Effect.Effect<
	{
		rows: TData[];
		rowCount: number;
		columnList: string[];
		hasNextPage: boolean;
	},
	SqlError,
	SqlClient.SqlClient
> =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const {
			limit = 50,
			offset = 0,
			orderBy,
			orderDirection = "asc",
			filters,
		} = input;

		const defaultSchema = yield* sql.onDialectOrElse({
			pg: () =>
				Effect.succeed(getDialectDefaultSchema(DatabaseDialect.Postgres)),
			sqlite: () =>
				Effect.succeed(getDialectDefaultSchema(DatabaseDialect.SQLite)),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});
		const baseSchema = input.schema === defaultSchema ? "" : input.schema;

		const joins = input.joins ?? [];
		const joinsRemapped = joins.map((j) => ({
			...j,
			schema: j.schema === defaultSchema ? "" : j.schema,
		}));

		// Fetch table columns for proper aliasing when using joins
		// Build list of tables we need columns for
		const tablesToFetch = [{ schema: input.schema, table: input.table }];
		if (joins.length > 0) {
			tablesToFetch.push(
				...joins.map((j) => ({ schema: j.schema, table: j.table })),
			);
		}

		// TODO cache
		// console.time("fetch columns");
		const columnResults = yield* Effect.all(
			tablesToFetch.map((t) =>
				Effect.andThen(
					getTableColumns({ schema: t.schema, table: t.table }),
					(columns) => ({
						schemaTable:
							!t.schema || t.schema === defaultSchema
								? t.table
								: `${t.schema}.${t.table}`,
						tableOnly: t.table,
						columns,
					}),
				),
			),
		);
		// console.timeEnd("fetch columns");

		// Build a map of table identifiers -> columns for quick lookup
		// Store both schema.table and table-only keys for PostgreSQL and SQLite compatibility
		const tableColumnsMap = new Map<string, TableColumnMetadata[]>();
		for (const result of columnResults) {
			tableColumnsMap.set(result.schemaTable, result.columns);
			tableColumnsMap.set(result.tableOnly, result.columns);
		}

		const columnList = columnResults.flatMap((r) =>
			r.columns.map((c) =>
				(input.joins ?? []).length > 0 ? `${r.tableOnly}.${c.name}` : c.name,
			),
		);

		const orderClause = orderBy
			? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}`
			: "";

		// Get count and rows
		const result = yield* sql.onDialectOrElse({
			pg: () =>
				Effect.gen(function* () {
					const pgJoinAliases = generateJoinAliases(
						joinsRemapped,
						input.table,
						baseSchema,
					);

					const pgJoinClauses = buildJoinSqlClauses(
						joinsRemapped,
						baseSchema,
						input.table,
						DatabaseDialect.Postgres,
						pgJoinAliases,
					).join("\n");

					const pgMainFilter =
						filters && filters.conditions.length > 0
							? buildPgWhereFragment(
									filters.conditions,
									filters.logicalOperator,
								)
							: "";

					const pgJoinFilter =
						joins.length > 0 ? buildPgJoinFilters(joins) : "";

					// Combine main table filters with join filters
					const pgWhereClause = [pgMainFilter, pgJoinFilter]
						.filter(Boolean)
						.join(" AND ");
					const whereFragment = pgWhereClause ? `WHERE ${pgWhereClause}` : "";

					const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${sql(input.schema)}.${sql(input.table)}
						${sql.unsafe(pgJoinClauses ? `\n${pgJoinClauses}` : "")}
						${sql.unsafe(whereFragment)}
					`;

					const selectPart =
						joins.length > 0
							? buildPgSelectWithJoins(
									baseSchema,
									input.table,
									joinsRemapped,
									tableColumnsMap,
									pgJoinAliases,
								)
							: "*";
					const query = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.schema)}.${sql(input.table)}
					${sql.unsafe(pgJoinClauses ? `\n${pgJoinClauses}` : "")}
					${sql.unsafe(whereFragment)}
					${sql.unsafe(orderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;
					// console.log(countQuery.compile());
					// console.log(query.compile());
					const [rows, countResult] = yield* Effect.all([query, countQuery]);
					const rowCount = Number(countResult[0]?.count ?? 0);
					return {
						rows: rows as TData[],
						columnList,
						rowCount,
						hasNextPage: offset + limit < rowCount,
					};
				}),
			sqlite: () =>
				Effect.gen(function* () {
					const sqliteJoinAliases = generateJoinAliases(
						joins,
						input.table,
						input.schema,
					);
					const sqliteJoinClauses = buildJoinSqlClauses(
						joins,
						input.schema,
						input.table,
						DatabaseDialect.SQLite,
						sqliteJoinAliases,
					).join("\n");
					const sqliteMainFilter =
						filters && filters.conditions.length > 0
							? buildSqliteWhereFragment(
									filters.conditions,
									filters.logicalOperator,
								)
							: "";

					const sqliteJoinFilter =
						joins.length > 0 ? buildSqliteJoinFilters(joins) : "";

					const sqliteWhereClause = [sqliteMainFilter, sqliteJoinFilter]
						.filter(Boolean)
						.join(" AND ");

					const whereFragment = sqliteWhereClause
						? `WHERE ${sqliteWhereClause}`
						: "";

					const countQuery = sql`
					SELECT COUNT(*) as count
					FROM ${sql(input.table)}
					${sql.unsafe(sqliteJoinClauses ? `\n${sqliteJoinClauses}` : "")}
					${sql.unsafe(whereFragment)}
				`;
					const selectPart =
						joins.length > 0
							? buildSqliteSelectWithJoins(
									input.table,
									joins,
									tableColumnsMap,
									sqliteJoinAliases,
								)
							: "*";
					const query = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.table)}
				${sql.unsafe(sqliteJoinClauses ? `\n${sqliteJoinClauses}` : "")}
				${sql.unsafe(whereFragment)}
				${sql.unsafe(orderClause)}
				LIMIT ${limit} OFFSET ${offset}
			`;
					// console.log(query.compile());
					const [rows, countResult] = yield* Effect.all([query, countQuery]);
					const rowCount = Number(countResult[0]?.count ?? 0);

					return {
						rows: rows as TData[],
						columnList,
						rowCount,
						hasNextPage: offset + limit < rowCount,
					};
				}),
			orElse: () => new SqlError({ cause: "Unsupported dialect" }),
		});

		return result;
	});
