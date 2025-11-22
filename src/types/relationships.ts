export interface TableRelationship {
	/**
	 * Type of relationship:
	 * "outgoing" - this table references another table (has FK)
	 * "incoming" - another table references this table
	 */
	type: "outgoing" | "incoming";

	/** The schema of the referencing table (has the FK column) */
	referencingSchema: string;

	/** The table that has the FK (references the other table) */
	referencingTable: string;

	/** The FK column in the referencing table */
	referencingColumn: string;

	/** The schema of the referenced table */
	referencedSchema: string;

	/** The table being referenced */
	referencedTable: string;

	/** The column being referenced (usually PK) */
	referencedColumn: string;

	/** Constraint name for uniqueness */
	constraintName: string;
}
