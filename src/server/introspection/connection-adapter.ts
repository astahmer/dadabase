import type { SqlClient } from "@effect/sql";
import type { SqlError } from "@effect/sql/SqlError";
import { Context, type Effect } from "effect";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import {
	type ColumnReference,
	type ColumnReferenceWithCount,
	type ForeignKeyInfo,
	type IndexInfo,
	type RelationshipCardinality,
	type TableColumnMetadata,
	type TableWithColumnsMetadata,
} from "./introspection.ts";

/**
 * DatabaseConnectionAdapter interface - abstracts database introspection operations
 */
export interface DatabaseConnectionAdapterType {
	dialect: "postgres" | "sqlite";

	// Database metadata
	readonly getAvailableDatabases: () => Effect.Effect<
		Array<{ name: string }>,
		SqlError,
		SqlClient.SqlClient
	>;
	readonly getAvailableSchemas: () => Effect.Effect<
		string[],
		SqlError,
		SqlClient.SqlClient
	>;
	readonly getAvailableTables: (input?: {
		schema?: string;
	}) => Effect.Effect<
		Array<{ name: string; schema: string }>,
		SqlError,
		SqlClient.SqlClient
	>;

	// Column and table metadata
	readonly getTableColumns: (input: {
		schema: string;
		table: string;
	}) => Effect.Effect<
		Array<TableColumnMetadata>,
		SqlError,
		SqlClient.SqlClient
	>;

	readonly getTableForeignKeys: (input: {
		schema: string;
		table: string;
	}) => Effect.Effect<Array<ForeignKeyInfo>, SqlError, SqlClient.SqlClient>;

	readonly getTableIndexes: (input: {
		schema: string;
		table: string;
	}) => Effect.Effect<Array<IndexInfo>, SqlError, SqlClient.SqlClient>;

	readonly getAllTablesColumns: (input: {
		schema: string;
	}) => Effect.Effect<
		Array<TableWithColumnsMetadata>,
		SqlError,
		SqlClient.SqlClient
	>;

	// Relationships
	readonly getTableRelationships: (input: {
		schema: string;
		table: string;
	}) => Effect.Effect<Array<TableRelationship>, SqlError, SqlClient.SqlClient>;

	readonly findColumnReferences: (input: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
	}) => Effect.Effect<Array<ColumnReference>, SqlError, SqlClient.SqlClient>;

	readonly findColumnReferencesWithCounts: (input: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
		cellValue: unknown;
	}) => Effect.Effect<
		Array<ColumnReferenceWithCount>,
		SqlError,
		SqlClient.SqlClient
	>;

	readonly getRelationshipCardinality: (input: {
		schema: string;
		table: string;
		columns: string[];
		isIncomingRelationship?: boolean;
	}) => Effect.Effect<RelationshipCardinality, SqlError, SqlClient.SqlClient>;

	readonly getRelationshipsCounts: (input: {
		schema: string;
		table: string;
		relationships: TableRelationshipInput[];
		rowData: Record<string, unknown>;
	}) => Effect.Effect<Record<string, number>, SqlError, SqlClient.SqlClient>;

	// Query execution
	readonly queryTableRows: <
		TData extends Record<string, unknown> = Record<string, unknown>,
	>(input: {
		schema: string;
		table: string;
		limit?: number;
		offset?: number;
		orderBy?: string;
		orderDirection?: "asc" | "desc";
		filters?: QueryFilterType;
	}) => Effect.Effect<
		{
			rows: TData[];
			rowCount: number;
			hasNextPage: boolean;
		},
		SqlError,
		SqlClient.SqlClient
	>;
}

export class DatabaseConnectionAdapter extends Context.Tag(
	"@dadabase/DatabaseConnectionAdapter",
)<DatabaseConnectionAdapter, DatabaseConnectionAdapterType>() {}

export interface TableRelationshipInput {
	constraintName: string;
	referencingSchema: string;
	referencingTable: string;
	referencingColumn: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	type: "incoming" | "outgoing";
}
