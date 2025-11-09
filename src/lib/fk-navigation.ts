import type {
	QueryFilterType,
	FilterConditionExpression,
} from "#src/lib/query-filter.ts";

/**
 * Generate a WHERE clause for filtering to a specific FK reference
 * @param column The column name to filter by
 * @param value The value to filter for (typically an ID)
 * @returns A filter condition that can be applied
 */
export function createFKFilterCondition(
	column: string,
	value: string | number,
): FilterConditionExpression {
	return {
		column,
		operator: "equals",
		value: String(value),
	};
}

/**
 * Generate a filter for following a foreign key reference
 * @param referencedColumn The FK column name
 * @param cellValue The cell value (ID to reference)
 * @returns A complete filter object
 */
export function createFollowFKFilter(
	referencedColumn: string,
	cellValue: unknown,
): QueryFilterType {
	return {
		conditions: [
			createFKFilterCondition(referencedColumn, cellValue as string | number),
		],
		logicalOperator: "and",
	};
}

/**
 * Format a reference for display in menu/UI
 * @param schema Schema name
 * @param table Table name
 * @param column Column name
 * @returns Formatted string like "schema.table.column"
 */
export function formatTableReference(
	schema: string,
	table: string,
	column?: string,
): string {
	return column ? `${schema}.${table}.${column}` : `${schema}.${table}`;
}

/**
 * Generate a human-readable label for a reference
 * @param table Table name
 * @param column Column name
 * @returns Label like "orders (order_id)"
 */
export function generateReferenceLabel(table: string, column?: string): string {
	return column ? `${table} (${column})` : table;
}

/**
 * Group references by table for easier display
 */
export function groupReferencesByTable(
	references: Array<{
		schema: string;
		table: string;
		column: string;
	}>,
): Map<string, Array<{ schema: string; column: string }>> {
	const grouped = new Map<string, Array<{ schema: string; column: string }>>();

	for (const ref of references) {
		const key = ref.table;
		if (!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key)!.push({ schema: ref.schema, column: ref.column });
	}

	return grouped;
}
