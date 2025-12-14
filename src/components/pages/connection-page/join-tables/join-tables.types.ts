/**
 * Types for join tables feature
 */

import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

export type JoinType = "left" | "inner";

/**
 * Join condition modes: standard FK-based, custom SQL expressions, or filter-based
 */
export type JoinConditionMode = "standard" | "custom" | "filters";

/**
 * Standard join condition using foreign key relationships
 */
export interface StandardJoinCondition {
	mode: "standard";
	/** Foreign key column in the referencing table */
	referencingColumn: string;
	/** Column in the referenced table that's being joined on */
	referencedColumn: string;
}

/**
 * Custom join condition using SQL expressions
 * Multiple conditions are combined with AND (INNER) or allowed NULLs (LEFT)
 */
export interface CustomJoinCondition {
	mode: "custom";
	/** Foreign key column in the referencing table (preserved for potential mode switch) */
	referencingColumn?: string;
	/** Column in the referenced table (preserved for potential mode switch) */
	referencedColumn?: string;
	/** Custom SQL ON clause expressions, e.g., ["products.deleted_at IS NULL", "vendors.status = 'active'"] */
	conditions: string[];
}

/**
 * Filter-based join condition using QueryFilterBuilder
 * Conditions are applied as ON clause filters on the joined table
 */
export interface FilterJoinCondition {
	mode: "filters";
	/** Foreign key column in the referencing table (preserved for potential mode switch) */
	referencingColumn?: string;
	/** Column in the referenced table (preserved for potential mode switch) */
	referencedColumn?: string;
	/** Filter conditions to apply to the joined table in the ON clause */
	filters?: QueryFilterType;
}

export interface JoinedTable {
	/** Table name to join */
	table: string;
	/** Schema of the table to join */
	schema: string;
	/** Type of join */
	type: JoinType;
	/** Columns to include from this table - "all" or specific column names */
	columns: "all" | string[];
	/** Join condition configuration (standard FK, custom SQL, or filter-based) */
	joinCondition:
		| StandardJoinCondition
		| CustomJoinCondition
		| FilterJoinCondition;
	/** Optional filter conditions to apply to the joined table (WHERE clause) */
	filters?: QueryFilterType;
	/** Optional custom alias for this join. If not provided, auto-generated as {tableName}_{index} when needed */
	alias?: string;
}

export interface JoinTablesConfig {
	/** List of tables to join */
	joins: JoinedTable[];
}

export interface JoinableTableOption {
	table: string;
	schema: string;
	referencingColumn: string;
	referencedColumn: string;
	/** Whether this is an "outgoing" FK (current table references this one) or "incoming" (this table references current) */
	direction: "outgoing" | "incoming";
}
