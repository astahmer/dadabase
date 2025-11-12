/**
 * Types and interfaces for relationship subrows feature
 */

export interface RelationshipMetadata {
	/** The FK column in the referencing table */
	referencingColumn: string;

	/** The table that has the FK (references this table) */
	referencingTable: string;

	/** Schema of the referencing table */
	referencingSchema: string;

	/** The PK column being referenced */
	referencedColumn: string;

	/** The table being referenced (current table) */
	referencedTable: string;

	/** Schema of the referenced table */
	referencedSchema: string;

	/** Constraint name for uniqueness */
	constraintName: string;

	/** Human-readable label for the relationship */
	displayLabel: string;
}

/** Tracks which relationships are expanded for each row */
export type RowRelationshipExpansionState = {
	[rowId: string]: Set<string>; // Set of constraintNames
};

/** Parameters for querying related rows */
export interface RelationshipSubrowQuery {
	schema: string;
	table: string;
	column: string;
	parentValue: unknown;
	limit?: number;
	offset?: number;
}
