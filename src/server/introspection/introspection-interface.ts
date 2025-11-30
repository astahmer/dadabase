import { Context } from "effect";
import type { Effect } from "effect";

/**
 * Information about a database table
 */
export interface TableInfo {
	name: string;
	schema?: string;
	type: "table" | "view" | "materialized_view";
	isSystem: boolean;
}

/**
 * Information about a table column
 */
export interface ColumnInfo {
	name: string;
	type: string;
	nullable: boolean;
	default?: string;
	isPrimaryKey: boolean;
	isAutoIncrement: boolean;
}

/**
 * Information about a foreign key constraint
 */
export interface ForeignKeyInfo {
	name: string;
	sourceTable: string;
	sourceColumn: string;
	referencedTable: string;
	referencedColumn: string;
	updateRule?: string;
	deleteRule?: string;
}

/**
 * Information about a table index
 */
export interface IndexInfo {
	name: string;
	isUnique: boolean;
	isPrimaryKey: boolean;
	columns: string[];
}

/**
 * Interface for database introspection
 * Implementations vary by dialect to handle their specific introspection mechanisms
 */
export interface IDatabaseIntrospector {
	getAvailableDatabases(): Effect.Effect<string[], any, any>;
	getAvailableSchemas(): Effect.Effect<string[], any, any>;
	getAvailableTables(schema?: string): Effect.Effect<TableInfo[], any, any>;
	getTableColumns(
		schema: string,
		table: string,
	): Effect.Effect<ColumnInfo[], any, any>;
	getTableForeignKeys(
		schema: string,
		table: string,
	): Effect.Effect<ForeignKeyInfo[], any, any>;
	getTableIndexes(
		schema: string,
		table: string,
	): Effect.Effect<IndexInfo[], any, any>;
}

/**
 * Context tag for database introspection service
 */
export class DatabaseIntrospector extends Context.Tag(
	"@dadabase/DatabaseIntrospector",
)<DatabaseIntrospector, IDatabaseIntrospector>() {}
