/**
 * Types for join tables feature
 */

import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

export type JoinType = "left" | "inner";

export interface JoinedTable {
	/** Table name to join */
	table: string;
	/** Schema of the table to join */
	schema: string;
	/** Type of join */
	type: JoinType;
	/** Columns to include from this table - "all" or specific column names */
	columns: "all" | string[];
	/** Foreign key column in the referencing table */
	referencingColumn: string;
	/** Column in the referenced table that's being joined on */
	referencedColumn: string;
	/** Optional filter conditions to apply to the joined table */
	filters?: QueryFilterType;
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
