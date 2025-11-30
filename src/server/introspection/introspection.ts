import { SqlClient, Statement } from "@effect/sql";
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

/**
 * Table relationship info for both incoming and outgoing relationships
 * Uses camelCase to match existing TableRelationship type for transparent migration
 */
interface TableRelationshipInfo {
	type: "outgoing" | "incoming";
	referencingSchema: string;
	referencingTable: string;
	referencingColumn: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	constraintName: string;
}

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
		const client = yield* SqlClient.SqlClient;
		const { schema, table } = input;

		return yield* client.onDialectOrElse({
			pg: () =>
				client<TableRelationshipInfo>`
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
					// SQLite only supports outgoing relationships via PRAGMA
					const rows = yield* client<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${table})
					`;
					return rows.map((row) => ({
						type: "outgoing" as const,
						referencingSchema: schema,
						referencingTable: table,
						referencingColumn: row.from,
						referencedSchema: "main",
						referencedTable: row.table,
						referencedColumn: row.to,
						constraintName: `fk_${row.id}`,
					})) as TableRelationshipInfo[];
				}),
			orElse: () =>
				client<TableRelationshipInfo>`
					SELECT
						'outgoing' as type,
						${schema} as "referencingSchema",
						${table} as "referencingTable",
						kcu.column_name as "referencingColumn",
						ccu.table_schema as "referencedSchema",
						ccu.table_name as "referencedTable",
						ccu.column_name as "referencedColumn",
						tc.constraint_name as "constraintName"
					FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage kcu
						ON tc.constraint_name = kcu.constraint_name
					JOIN information_schema.constraint_column_usage ccu
						ON tc.constraint_name = ccu.constraint_name
					WHERE tc.constraint_type = 'FOREIGN KEY'
					AND tc.table_schema = ${schema}
					AND tc.table_name = ${table}
				`,
		});
	});

/**
 * Column reference info for reverse FK lookup (camelCase to match Kysely interface)
 */
interface ColumnReferenceInfo {
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
		const client = yield* SqlClient.SqlClient;
		const { referencedSchema, referencedTable, referencedColumn } = input;

		return yield* client.onDialectOrElse({
			pg: () =>
				client<ColumnReferenceInfo>`
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
				// SQLite doesn't have a system-wide FK reverse lookup
				// Return empty array - callers need to handle this limitation
				Effect.succeed([] as ColumnReferenceInfo[]),
			orElse: () =>
				client<ColumnReferenceInfo>`
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
		});
	});

/**
 * Column reference info with matching row count
 */
interface ColumnReferenceWithCount extends ColumnReferenceInfo {
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
		const client = yield* SqlClient.SqlClient;
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
			references.map((ref) =>
				client.onDialectOrElse({
					pg: () => {
						// Build the count query based on whether value is null
						if (normalizedCellValue === null) {
							return client<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${Statement.unsafeFragment(`"${ref.schema}"."${ref.table}"`)}
								WHERE ${Statement.unsafeFragment(`"${ref.column}"`)} IS NULL
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
						return client<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${Statement.unsafeFragment(`"${ref.schema}"."${ref.table}"`)}
							WHERE ${Statement.unsafeFragment(`"${ref.column}"`)} = ${normalizedCellValue}
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
					sqlite: () =>
						// SQLite: return 0 since we can't do reverse FK lookup
						Effect.succeed({
							...ref,
							matchingRowCount: 0,
						} as ColumnReferenceWithCount),
					orElse: () => {
						if (normalizedCellValue === null) {
							return client<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${Statement.unsafeFragment(`"${ref.schema}"."${ref.table}"`)}
								WHERE ${Statement.unsafeFragment(`"${ref.column}"`)} IS NULL
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
						return client<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${Statement.unsafeFragment(`"${ref.schema}"."${ref.table}"`)}
							WHERE ${Statement.unsafeFragment(`"${ref.column}"`)} = ${normalizedCellValue}
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
				}),
			),
		);

		return referencesWithCounts;
	});

/**
 * Relationship cardinality info
 */
export type Cardinality =
	| "one-to-one"
	| "one-to-many"
	| "many-to-one"
	| "many-to-many";

interface CardinalityInfo {
	cardinality: Cardinality;
}

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
}) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;
		const { schema, table, isIncomingRelationship } = input;

		const result = yield* client.onDialectOrElse({
			pg: () =>
				client<CardinalityInfo>`
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
				// SQLite doesn't have easy access to constraint metadata
				// Default to many-to-one as a safe assumption
				Effect.succeed([{ cardinality: "many-to-one" as Cardinality }]),
			orElse: () =>
				// Default fallback - assume many-to-one
				Effect.succeed([{ cardinality: "many-to-one" as Cardinality }]),
		});

		// If no result found, return defaults based on relationship direction
		if (result.length === 0) {
			if (isIncomingRelationship) {
				return { cardinality: "one-to-many" as Cardinality };
			}
			return { cardinality: "many-to-one" as Cardinality };
		}

		let cardinality = result[0].cardinality;

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

		return { cardinality };
	});

/**
 * Input type for relationship counting
 */
interface TableRelationshipInput {
	constraintName: string;
	referencingSchema: string;
	referencingTable: string;
	referencingColumn: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	type: "incoming" | "outgoing";
}

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
		const client = yield* SqlClient.SqlClient;
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

					const count = yield* client.onDialectOrElse({
						pg: () =>
							client<{ count: number }>`
								SELECT COUNT(*)::bigint as count
								FROM ${Statement.unsafeFragment(`"${rel.referencingSchema}"."${rel.referencingTable}"`)}
								WHERE ${Statement.unsafeFragment(`"${rel.referencingColumn}"`)} = ${String(filterValue)}
							`.pipe(
								Effect.map((rows) => Number(rows[0]?.count ?? 0)),
								Effect.catchAll(() => Effect.succeed(0)),
							),
						sqlite: () =>
							client<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${Statement.unsafeFragment(`"${rel.referencingTable}"`)}
								WHERE ${Statement.unsafeFragment(`"${rel.referencingColumn}"`)} = ${String(filterValue)}
							`.pipe(
								Effect.map((rows) => Number(rows[0]?.count ?? 0)),
								Effect.catchAll(() => Effect.succeed(0)),
							),
						orElse: () =>
							client<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${Statement.unsafeFragment(`"${rel.referencingSchema}"."${rel.referencingTable}"`)}
								WHERE ${Statement.unsafeFragment(`"${rel.referencingColumn}"`)} = ${String(filterValue)}
							`.pipe(
								Effect.map((rows) => Number(rows[0]?.count ?? 0)),
								Effect.catchAll(() => Effect.succeed(0)),
							),
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
