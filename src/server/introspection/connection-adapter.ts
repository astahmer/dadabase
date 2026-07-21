import type { SqlClient } from "@effect/sql";
import type { SqlError } from "@effect/sql/SqlError";

import { Context, type Effect } from "effect";

import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

import type { RemoteConnection } from "../db-connection/remote-connection.tag.ts";
import type { QueryLogger } from "../query-logger/query-logger.ts";
import type {
  ColumnReference,
  ColumnReferenceWithCount,
  ForeignKeyInfo,
  IndexInfo,
  RelationshipCardinality,
  TableColumnMetadata,
  TableWithColumnsMetadata,
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
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;
  readonly getAvailableSchemas: () => Effect.Effect<
    string[],
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;
  readonly getAvailableTables: (input?: {
    schema?: string;
  }) => Effect.Effect<
    Array<{ name: string; schema: string }>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  // Column and table metadata
  readonly getTableColumns: (input: {
    schema: string;
    table: string;
  }) => Effect.Effect<
    Array<TableColumnMetadata>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly getTableForeignKeys: (input: {
    schema: string;
    table: string;
  }) => Effect.Effect<
    Array<ForeignKeyInfo>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly getTableIndexes: (input: {
    schema: string;
    table: string;
  }) => Effect.Effect<
    Array<IndexInfo>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly getAllTablesColumns: (input: {
    schema: string;
  }) => Effect.Effect<
    Array<TableWithColumnsMetadata>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  // Relationships
  readonly getTableRelationships: (input: {
    schema: string;
    table: string;
  }) => Effect.Effect<
    Array<TableRelationship>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly findColumnReferences: (input: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
  }) => Effect.Effect<
    Array<ColumnReference>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly findColumnReferencesWithCounts: (input: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
    cellValue: unknown;
  }) => Effect.Effect<
    Array<ColumnReferenceWithCount>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly getRelationshipCardinality: (input: {
    schema: string;
    table: string;
    columns: string[];
    isIncomingRelationship?: boolean;
  }) => Effect.Effect<
    RelationshipCardinality,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

  readonly getRelationshipsCounts: (input: {
    schema: string;
    table: string;
    relationships: TableRelationshipInput[];
    rowData: Record<string, unknown>;
  }) => Effect.Effect<
    Record<string, number>,
    SqlError,
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;

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
    SqlClient.SqlClient | QueryLogger | RemoteConnection
  >;
}

export class DatabaseConnectionAdapter extends Context.Tag("@dadabase/DatabaseConnectionAdapter")<
  DatabaseConnectionAdapter,
  DatabaseConnectionAdapterType
>() {}

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
