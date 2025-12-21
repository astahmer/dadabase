import type {
	FilterConditionExpression,
	FilterOperatorType,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";

/**
 * Parses a SQL query string to extract:
 * - WHERE clause conditions as QueryFilterType
 * - ORDER BY clause as orderBy and orderDirection
 * - LIMIT/OFFSET as limit and offset
 * - Selected columns as hiddenColumnList
 *
 * Returns partial tab state updates that can be merged with existing state
 */
export interface ParsedSqlQueryState {
	filters?: QueryFilterType;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	limit?: number;
	offset?: number;
	hiddenColumnList?: string[];
}

/**
 * Simple regex-based SQL WHERE clause parser
 * Handles basic operators and conditions, not full SQL parsing
 */
export const parseSqlQuery = (
	sql: string,
	availableColumns: string[],
): ParsedSqlQueryState => {
	const result: ParsedSqlQueryState = {};

	// Normalize the SQL (remove extra whitespace, handle line breaks)
	const normalizedSql = sql.replace(/\s+/g, " ").toUpperCase().trim();

	// Parse WHERE clause
	const whereMatch = normalizedSql.match(
		/WHERE\s+(.+?)(?:ORDER BY|LIMIT|OFFSET|GROUP BY|HAVING|$)/i,
	);
	if (whereMatch && whereMatch[1]) {
		const whereClause = whereMatch[1].trim();
		const filters = parseWhereClause(whereClause, availableColumns);
		if (filters.conditions.length > 0) {
			result.filters = filters;
		}
	}

	// Parse ORDER BY clause - takes the FIRST column in ORDER BY
	// Handles quoted identifiers: `name`, "name", or unquoted name
	const orderByMatch = normalizedSql.match(
		/ORDER\s+BY\s+[`"]?(\w+)[`"]?(?:\s+(ASC|DESC))?/i,
	);
	if (orderByMatch && orderByMatch[1]) {
		const column = orderByMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			result.orderBy = column;
			result.orderDirection =
				(orderByMatch[2]?.toLowerCase() as "asc" | "desc") || ("asc" as const);
		}
	}

	// Parse LIMIT clause
	const limitMatch = normalizedSql.match(/LIMIT\s+(\d+)/i);
	if (limitMatch && limitMatch[1]) {
		result.limit = parseInt(limitMatch[1], 10);
	}

	// Parse OFFSET clause
	const offsetMatch = normalizedSql.match(/OFFSET\s+(\d+)/i);
	if (offsetMatch && offsetMatch[1]) {
		result.offset = parseInt(offsetMatch[1], 10);
	}

	// Parse SELECT clause to determine hidden columns
	const selectMatch = normalizedSql.match(/SELECT\s+(.+?)\s+FROM/);
	if (selectMatch && selectMatch[1]) {
		const selectedPart = selectMatch[1].trim();
		// If not SELECT *, track which columns are selected
		if (selectedPart !== "*") {
			const selectedColumns = selectedPart
				.split(",")
				.map((col) => col.trim().replace(/["`]/g, "").toLowerCase());

			// Hidden columns are those NOT in the SELECT list
			const hidden = availableColumns.filter(
				(col) => !selectedColumns.includes(col.toLowerCase()),
			);
			if (hidden.length > 0) {
				result.hiddenColumnList = hidden;
			}
		}
	}

	return result;
};

/**
 * Parses a WHERE clause into FilterConditionExpression array
 * Handles:
 * - Simple comparisons: col = value, col > value, etc.
 * - NULL checks: col IS NULL, col IS NOT NULL
 * - String operations: col LIKE '%value%', col ILIKE '%value%'
 * - IN/NOT IN: col IN (val1, val2), col NOT IN (val1, val2)
 * - AND/OR logical operators
 */
export const parseWhereClause = (
	whereClause: string,
	availableColumns: string[],
): QueryFilterType => {
	const conditions: FilterConditionExpression[] = [];

	// Determine logical operator (AND vs OR)
	// Default to AND, but if OR is present and more common, use OR
	const andCount = (whereClause.match(/\s+AND\s+/gi) || []).length;
	const orCount = (whereClause.match(/\s+OR\s+/gi) || []).length;
	const logicalOperator =
		orCount > andCount ? ("or" as const) : ("and" as const);

	// Split by logical operators while preserving the conditions
	const parts = whereClause.split(/\s+(?:AND|OR)\s+/gi);

	for (const part of parts) {
		const condition = parseCondition(part.trim(), availableColumns);
		if (condition) {
			conditions.push(condition);
		}
	}

	return {
		conditions,
		logicalOperator,
	};
};

/**
 * Parses a single condition like "column = value" or "column LIKE '%text%'"
 * @internal
 */
export const parseCondition = (
	condition: string,
	availableColumns: string[],
): FilterConditionExpression | null => {
	condition = condition.trim();
	if (!condition) return null;

	// Handle IS NULL / IS NOT NULL
	const nullMatch = condition.match(/^["`]?(\w+)["`]?\s+IS\s+(NOT\s+)?NULL$/i);
	if (nullMatch) {
		const column = nullMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			return {
				column,
				operator: nullMatch[2]
					? ("is_not_null" as const)
					: ("is_null" as const),
			};
		}
	}

	// Handle IN / NOT IN
	const inMatch = condition.match(
		/^["`]?(\w+)["`]?\s+(NOT\s+)?IN\s*\(\s*(.+?)\s*\)$/i,
	);
	if (inMatch) {
		const column = inMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			const values = inMatch[3].split(",").map(
				(v) => v.trim().replace(/^['"]|['"]$/g, ""), // Remove quotes
			);
			return {
				column,
				operator: inMatch[2] ? ("not_in" as const) : ("in" as const),
				value: values,
			};
		}
	}

	// Handle LIKE / ILIKE with wildcards
	const likeMatch = condition.match(
		/^["`]?(\w+)["`]?\s+(NOT\s+)?LIKE\s+['"](.+?)['"]$/i,
	);
	if (likeMatch) {
		const column = likeMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			const value = likeMatch[3];
			const operator = detectLikeOperator(value, likeMatch[2] ? true : false);
			return {
				column,
				operator,
				value: value.replace(/%/g, ""),
			};
		}
	}

	// Handle standard comparison operators: =, !=, <>, <, >, <=, >=
	// Must check two-character operators before single-character ones
	const comparisonMatch = condition.match(
		/^["`]?(\w+)["`]?\s*(<=|>=|<>|!=|=|<|>)\s*['"]?(.+?)['"]?$/,
	);
	if (comparisonMatch) {
		const column = comparisonMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			const op = comparisonMatch[2];
			const value = comparisonMatch[3].trim();

			const operatorMap: Record<string, FilterOperatorType> = {
				"=": "equals",
				"!=": "not_equals",
				"<>": "not_equals",
				"<": "less_than",
				">": "greater_than",
				"<=": "less_than_or_equal",
				">=": "greater_than_or_equal",
			};

			return {
				column,
				operator: operatorMap[op] || "equals",
				value: isNumeric(value) ? parseFloat(value) : value,
			};
		}
	}

	return null;
};

/**
 * Determines the specific LIKE operator based on wildcard pattern
 */
const detectLikeOperator = (
	pattern: string,
	isNotLike: boolean,
): FilterOperatorType => {
	if (isNotLike) {
		if (pattern.startsWith("%") && pattern.endsWith("%")) {
			return "not_contains";
		}
		if (pattern.startsWith("%")) {
			return "ends_with"; // Inverse: does NOT end with
		}
		if (pattern.endsWith("%")) {
			return "starts_with"; // Inverse: does NOT start with
		}
	}

	if (pattern.startsWith("%") && pattern.endsWith("%")) {
		return "contains";
	}
	if (pattern.startsWith("%")) {
		return "ends_with";
	}
	if (pattern.endsWith("%")) {
		return "starts_with";
	}

	return "equals";
};

/**
 * Check if a string represents a number
 */
const isNumeric = (value: string): boolean => {
	return !isNaN(parseFloat(value)) && isFinite(Number(value));
};
