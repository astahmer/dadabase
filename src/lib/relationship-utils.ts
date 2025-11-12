import type { RelationshipMetadata } from "../types/relationships";

/**
 * Format a relationship display label from table name
 * Example: "orders" → "Orders"
 */
export function formatRelationshipDisplayLabel(tableName: string): string {
	return tableName.charAt(0).toUpperCase() + tableName.slice(1);
}

/**
 * Convert ForeignKeyMetadata from server to RelationshipMetadata
 */
export function mapForeignKeyToRelationship(fk: {
	columnName: string;
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
	constraintName: string;
}): RelationshipMetadata {
	return {
		referencingColumn: fk.columnName,
		referencingTable: fk.referencedTable,
		referencingSchema: fk.referencedSchema,
		referencedColumn: fk.referencedColumn,
		referencedTable: fk.referencedTable,
		referencedSchema: fk.referencedSchema,
		constraintName: fk.constraintName,
		displayLabel: formatRelationshipDisplayLabel(fk.referencedTable),
	};
}

/**
 * Convert ColumnReference from server to RelationshipMetadata
 * This represents tables that reference the current table
 */
export function mapColumnReferenceToRelationship(ref: {
	schema: string;
	table: string;
	column: string;
	referencedColumn: string;
	constraintName: string;
}): RelationshipMetadata {
	return {
		referencingColumn: ref.column,
		referencingTable: ref.table,
		referencingSchema: ref.schema,
		referencedColumn: ref.referencedColumn,
		referencedTable: "", // Will be filled from context
		referencedSchema: "", // Will be filled from context
		constraintName: ref.constraintName,
		displayLabel: formatRelationshipDisplayLabel(ref.table),
	};
}

/**
 * Validate a relationship has all required fields
 */
export function isValidRelationship(
	rel: Partial<RelationshipMetadata>,
): rel is RelationshipMetadata {
	return !!(
		rel.referencingColumn &&
		rel.referencingTable &&
		rel.referencingSchema &&
		rel.referencedColumn &&
		rel.referencedTable &&
		rel.referencedSchema &&
		rel.constraintName &&
		rel.displayLabel
	);
}

/**
 * Group relationships by table
 */
export function groupRelationshipsByTable(
	relationships: RelationshipMetadata[],
): Map<string, RelationshipMetadata[]> {
	const grouped = new Map<string, RelationshipMetadata[]>();

	for (const rel of relationships) {
		const key = rel.referencingTable;
		if (!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key)!.push(rel);
	}

	return grouped;
}

/**
 * Create a unique ID for a relationship (for expansion state)
 */
export function getRelationshipId(rel: RelationshipMetadata): string {
	return `${rel.referencingSchema}.${rel.referencingTable}.${rel.constraintName}`;
}
