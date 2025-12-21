import type {
	FilterConditionExpression,
	FilterOperatorType,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";

/**
 * Parses a SQL query string to extract:
 * - WHERE clause conditions as QueryFilterType
 * - GROUP BY columns
 * - HAVING clause conditions as QueryFilterType
 * - ORDER BY clause as orderBy and orderDirection
 * - LIMIT/OFFSET as limit and offset
 * - Selected columns as hiddenColumnList
 * - JOIN clauses (LEFT, INNER, RIGHT, FULL OUTER, CROSS)
 *
 * Returns partial tab state updates that can be merged with existing state
 */
export interface ParsedSqlQueryState {
	filters?: QueryFilterType;
	groupBy?: string[];
	having?: QueryFilterType;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	limit?: number;
	offset?: number;
	hiddenColumnList?: string[];
	joins?: JoinedTable[];
}

// ============================================================================
// Compiled Regex Patterns (reused across functions to avoid recompilation)
// ============================================================================

// Matches optional schema and/or table prefix with flexible quoting
// Each qualifier part can be independently quoted or unquoted:
// - "public"."accounting_imports"."category"
// - "public".accounting_imports."category"
// - public."accounting_imports".category
// - public.accounting_imports.category
const QUALIFIER_PREFIX = /(?:(?:["`]?\w+["`]?)\.){0,2}/;

// Captures quoted or unquoted column name: column or "column" or `column`
const COLUMN_NAME = /["`]?(\w+)["`]?/;

// Pattern for matching fully qualified identifiers (schema.table.column or table.column)
// Matches: column, table.column, schema.table.column, with various quoting styles
// This avoids escaping backticks by using a literal pattern string
const QUALIFIED_IDENTIFIER_PATTERN = '(?:["`]?\\w+["`]?\\.){0,2}["`]?\\w+["`]?';

// SQL clause patterns
const WHERE_CLAUSE_REGEX =
	/WHERE\s+(.+?)(?:ORDER BY|LIMIT|OFFSET|GROUP BY|HAVING|$)/i;
const GROUP_BY_REGEX = /GROUP\s+BY\s+(.+?)(?:HAVING|ORDER BY|LIMIT|OFFSET|$)/i;
const HAVING_REGEX = /HAVING\s+(.+?)(?:ORDER BY|LIMIT|OFFSET|$)/i;
const ORDER_BY_REGEX = new RegExp(
	`ORDER\\s+BY\\s+${QUALIFIER_PREFIX.source}${COLUMN_NAME.source}(?:\\s+(ASC|DESC))?`,
	"i",
);
const LIMIT_REGEX = /LIMIT\s+(\d+)/i;
const OFFSET_REGEX = /OFFSET\s+(\d+)/i;
const SELECT_REGEX = /SELECT\s+(.+?)\s+FROM/i;

// JOIN patterns: capture JOIN type, table name, optional alias, and ON conditions
// Supports: LEFT JOIN, INNER JOIN, RIGHT JOIN, FULL OUTER JOIN, CROSS JOIN
// Examples:
// - LEFT JOIN "table"
// - INNER JOIN "table" AS alias
// - RIGHT JOIN schema.table alias
// - FULL OUTER JOIN "table" ON conditions
// - CROSS JOIN "table"
const JOIN_TYPE_REGEX =
	/(LEFT|INNER|RIGHT|FULL\s+OUTER|CROSS)(?:\s+OUTER)?\s+JOIN\s+(["`]?[\w.]+["`]?)(?:\s+(?:AS\s+)?(["`]?\w+["`]?))?(?:\s+ON\s+(.+?))?(?=\s+(?:LEFT|INNER|RIGHT|FULL|CROSS|WHERE|ORDER|LIMIT|OFFSET|GROUP|HAVING)|$)/gi;

// Logical operators for WHERE clause
const AND_SPLIT_REGEX = /\s+AND\s+/gi;
const OR_SPLIT_REGEX = /\s+OR\s+/gi;
const LOGICAL_SPLIT_REGEX = /\s+(?:AND|OR)\s+/gi;

// Condition patterns (with schema.table.column support)
// Group 1 captures the full qualified identifier
const IS_NULL_REGEX = new RegExp(
	`^(${QUALIFIED_IDENTIFIER_PATTERN})\\s+IS\\s+(NOT\\s+)?NULL$`,
	"i",
);
const IN_REGEX = new RegExp(
	`^(${QUALIFIED_IDENTIFIER_PATTERN})\\s+(NOT\\s+)?IN\\s*\\(\\s*(.+?)\\s*\\)$`,
	"i",
);
const LIKE_REGEX = new RegExp(
	`^(${QUALIFIED_IDENTIFIER_PATTERN})\\s+(NOT\\s+)?LIKE\\s+['"](.+?)['"]$`,
	"i",
);
const COMPARISON_REGEX = new RegExp(
	`^(${QUALIFIED_IDENTIFIER_PATTERN})\\s*(<=|>=|<>|!=|=|<|>)\\s*['"]?(.+?)['"]?$`,
);
// Aggregate function pattern for HAVING clauses: COUNT(*), SUM(col), AVG(col), etc.
const AGGREGATE_COMPARISON_REGEX =
	/^(\w+\([^)]*\))\s*(<=|>=|<>|!=|=|<|>)\s*['"]?(.+?)['"]?$/;

/**
 * Extracts the column name and table/schema prefix from a qualified identifier
 * Handles:
 * - Simple: column, "column", `column` → { column: "column", table: undefined }
 * - Table-qualified: table.column, "table"."column" → { column: "column", table: "table" }
 * - Schema-qualified: schema.table.column → { column: "column", table: "table" }
 * Returns object with column name and optional table name
 */
const extractTableAndColumn = (
	identifier: string,
): { column: string; table?: string } => {
	const identifier_clean = identifier.trim().toLowerCase();

	// Match fully qualified identifier: optional schema, optional table, column
	// Pattern: [schema.][table.]column
	const fullMatch = identifier_clean.match(
		/^(?:(?:["`]?\w+["`]?)\.){0,2}["`]?(\w+)["`]?$/,
	);

	if (!fullMatch) {
		return { column: identifier_clean };
	}

	// Split by dots to extract parts (removing quotes)
	const parts = identifier_clean
		.split(".")
		.map((part) => part.replace(/["`]/g, ""));

	// Filter out empty parts
	const cleanParts = parts.filter((p) => p.length > 0);

	if (cleanParts.length === 1) {
		// Just column name
		return { column: cleanParts[0] };
	}

	if (cleanParts.length === 2) {
		// table.column
		return { table: cleanParts[0], column: cleanParts[1] };
	}

	if (cleanParts.length >= 3) {
		// schema.table.column - return table (second-to-last part) and column (last part)
		return {
			table: cleanParts[cleanParts.length - 2],
			column: cleanParts[cleanParts.length - 1],
		};
	}

	return { column: identifier_clean };
};

/**
 * Extracts the column name from a potentially qualified identifier
 * Handles:
 * - Simple: column, "column", `column`
 * - Table-qualified: table.column, "table"."column", table."column"
 * - Schema-qualified: schema.table.column, "schema"."table"."column", etc.
 * Returns the column name without any prefix
 */
const extractColumnName = (identifier: string): string => {
	const { column } = extractTableAndColumn(identifier);
	return column;
};

/**
 * Extracts the column name and strips aliases
 * Handles: col AS alias, col alias, "col" "alias", col AS "alias", etc.
 * Returns just the column name (left side of AS or space-separated alias)
 */
const extractColumnNameWithAlias = (columnExpression: string): string => {
	// Remove alias: split on AS keyword (case-insensitive)
	const withoutAlias = columnExpression.split(/\s+AS\s+/i)[0].trim();

	// Also handle space-separated aliases without AS (e.g., "col alias")
	// Only take the first part if multiple space-separated identifiers
	const parts = withoutAlias.split(/\s+/);
	const columnPart = parts[0].trim();

	return extractColumnName(columnPart);
};

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
	const whereMatch = normalizedSql.match(WHERE_CLAUSE_REGEX);
	if (whereMatch && whereMatch[1]) {
		const whereClause = whereMatch[1].trim();
		const filters = parseWhereClause(whereClause, availableColumns);
		if (filters.conditions.length > 0) {
			result.filters = filters;
		}
	}

	// Parse ORDER BY clause - takes the FIRST column in ORDER BY
	// Handles quoted identifiers and table-qualified columns: table.column, "table"."column", etc.
	const orderByMatch = normalizedSql.match(ORDER_BY_REGEX);
	if (orderByMatch && orderByMatch[1]) {
		const column = orderByMatch[1].toLowerCase();
		if (availableColumns.includes(column)) {
			result.orderBy = column;
			result.orderDirection =
				(orderByMatch[2]?.toLowerCase() as "asc" | "desc") || ("asc" as const);
		}
	}

	// Parse LIMIT clause
	const limitMatch = normalizedSql.match(LIMIT_REGEX);
	if (limitMatch && limitMatch[1]) {
		result.limit = parseInt(limitMatch[1], 10);
	}

	// Parse OFFSET clause
	const offsetMatch = normalizedSql.match(OFFSET_REGEX);
	if (offsetMatch && offsetMatch[1]) {
		result.offset = parseInt(offsetMatch[1], 10);
	}

	// Parse GROUP BY clause
	const groupByMatch = normalizedSql.match(GROUP_BY_REGEX);
	if (groupByMatch && groupByMatch[1]) {
		const groupByClause = groupByMatch[1].trim();
		const groupByColumns = groupByClause.split(",").map((col) => {
			const cleaned = extractColumnName(col.trim());
			return cleaned;
		});
		if (groupByColumns.length > 0) {
			result.groupBy = groupByColumns;
		}
	}

	// Parse HAVING clause
	const havingMatch = normalizedSql.match(HAVING_REGEX);
	if (havingMatch && havingMatch[1]) {
		const havingClause = havingMatch[1].trim();
		// HAVING conditions don't filter by availableColumns (can reference aggregates)
		const having = parseHavingClause(havingClause);
		if (having.conditions.length > 0) {
			result.having = having;
		}
	}

	// Parse SELECT clause to determine hidden columns
	const selectMatch = normalizedSql.match(SELECT_REGEX);
	if (selectMatch && selectMatch[1]) {
		const selectedPart = selectMatch[1].trim();
		// If not SELECT *, track which columns are selected
		if (selectedPart !== "*") {
			const selectedColumns = selectedPart.split(",").map((col) => {
				// Handle aliases and qualified column names
				return extractColumnNameWithAlias(col.trim());
			});

			// Hidden columns are those NOT in the SELECT list
			const hidden = availableColumns.filter(
				(col) => !selectedColumns.includes(col.toLowerCase()),
			);
			if (hidden.length > 0) {
				result.hiddenColumnList = hidden;
			}
		}
	}

	// Parse JOIN clauses (LEFT, INNER, RIGHT, FULL OUTER, CROSS)
	const joins = parseJoins(sql, availableColumns);
	if (joins.length > 0) {
		result.joins = joins;
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
	const andCount = (whereClause.match(AND_SPLIT_REGEX) || []).length;
	const orCount = (whereClause.match(OR_SPLIT_REGEX) || []).length;
	const logicalOperator =
		orCount > andCount ? ("or" as const) : ("and" as const);

	// Split by logical operators while preserving the conditions
	const parts = whereClause.split(LOGICAL_SPLIT_REGEX);

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
 * Parses HAVING clause conditions
 * Similar to parseWhereClause but doesn't filter by availableColumns
 * since HAVING can reference aggregates and GROUP BY columns
 */
const parseHavingClause = (havingClause: string): QueryFilterType => {
	const conditions: FilterConditionExpression[] = [];

	// Determine logical operator (AND vs OR)
	const andCount = (havingClause.match(AND_SPLIT_REGEX) || []).length;
	const orCount = (havingClause.match(OR_SPLIT_REGEX) || []).length;
	const logicalOperator =
		orCount > andCount ? ("or" as const) : ("and" as const);

	// Split by logical operators while preserving the conditions
	const parts = havingClause.split(LOGICAL_SPLIT_REGEX);

	for (const part of parts) {
		const condition = parseOnCondition(part.trim());
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
 * Parses ON clause conditions in JOIN
 * Similar to parseWhereClause but doesn't filter by availableColumns
 * since JOIN conditions may reference columns from the joined table
 */
const parseOnClause = (onClause: string): QueryFilterType => {
	const conditions: FilterConditionExpression[] = [];

	// Determine logical operator (AND vs OR)
	const andCount = (onClause.match(AND_SPLIT_REGEX) || []).length;
	const orCount = (onClause.match(OR_SPLIT_REGEX) || []).length;
	const logicalOperator =
		orCount > andCount ? ("or" as const) : ("and" as const);

	// Split by logical operators while preserving the conditions
	const parts = onClause.split(LOGICAL_SPLIT_REGEX);

	for (const part of parts) {
		const condition = parseOnCondition(part.trim());
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
 * Parses a single ON condition (doesn't require column to be in availableColumns)
 * @internal
 */
const parseOnCondition = (
	condition: string,
): FilterConditionExpression | null => {
	condition = condition.trim();
	if (!condition) return null;

	// Handle IS NULL / IS NOT NULL
	const nullMatch = condition.match(IS_NULL_REGEX);
	if (nullMatch) {
		const { column, table } = extractTableAndColumn(nullMatch[1]);
		return {
			column,
			...(table && { table }),
			operator: nullMatch[2] ? ("is_not_null" as const) : ("is_null" as const),
		};
	}

	// Handle IN / NOT IN
	const inMatch = condition.match(IN_REGEX);
	if (inMatch) {
		const { column, table } = extractTableAndColumn(inMatch[1]);
		const values = inMatch[3]
			.split(",")
			.map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
		return {
			column,
			...(table && { table }),
			operator: inMatch[2] ? ("not_in" as const) : ("in" as const),
			value: values,
		};
	}

	// Handle LIKE / NOT LIKE with wildcards
	const likeMatch = condition.match(LIKE_REGEX);
	if (likeMatch) {
		const { column, table } = extractTableAndColumn(likeMatch[1]);
		const value = likeMatch[3];
		const operator = detectLikeOperator(value, likeMatch[2] ? true : false);
		return {
			column,
			...(table && { table }),
			operator,
			value: value.replace(/%/g, ""),
		};
	}

	// Handle standard comparison operators
	const comparisonMatch = condition.match(COMPARISON_REGEX);
	if (comparisonMatch) {
		const { column, table } = extractTableAndColumn(comparisonMatch[1]);
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
			...(table && { table }),
			operator: operatorMap[op] || "equals",
			value: isNumeric(value) ? parseFloat(value) : value,
		};
	}

	// Handle aggregate functions for HAVING clause: COUNT(*), SUM(col), etc.
	const aggregateMatch = condition.match(AGGREGATE_COMPARISON_REGEX);
	if (aggregateMatch) {
		const column = aggregateMatch[1]; // e.g., "COUNT(*)", "SUM(amount)"
		const op = aggregateMatch[2];
		const value = aggregateMatch[3].trim();

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

	return null;
};
/**
 * Parses JOIN clauses (LEFT, INNER, RIGHT, FULL OUTER, CROSS)
 * Returns array of JoinedTable objects with appropriate join types
 */
export const parseJoins = (
	sql: string,
	availableColumns: string[],
): JoinedTable[] => {
	const joins: JoinedTable[] = [];
	const normalizedSql = sql.replace(/\s+/g, " ").toUpperCase();

	// Reset regex state before use
	JOIN_TYPE_REGEX.lastIndex = 0;

	let match;
	while ((match = JOIN_TYPE_REGEX.exec(normalizedSql)) !== null) {
		// Extract and normalize JOIN type
		const joinTypeRaw = match[1].trim();
		const joinType: JoinedTable["type"] = normalizeJoinType(joinTypeRaw);

		// Extract and clean table name - remove quotes and get last part (in case of schema.table)
		const tableRaw = match[2].trim().toLowerCase();
		const tableParts = tableRaw
			.replace(/["`]/g, "")
			.split(".")
			.filter((p) => p.length > 0);

		// Determine schema and table from parts
		let schema = ""; // empty string if not specified
		let tableName: string;

		if (tableParts.length === 2) {
			// schema.table format
			schema = tableParts[0];
			tableName = tableParts[1];
		} else {
			// Just table name
			tableName = tableParts[tableParts.length - 1];
		}

		// Extract and clean alias - remove quotes
		const aliasRaw = match[3];
		const alias = aliasRaw
			? aliasRaw.trim().toLowerCase().replace(/["`]/g, "")
			: undefined;

		// Extract ON clause (original case to preserve for parsing)
		// CROSS JOIN doesn't support ON clause
		const onClause = match[4]?.trim();

		// Build join condition from parsed ON clause
		let joinCondition: JoinedTable["joinCondition"] = {
			mode: "custom",
			conditions: [],
		};

		if (onClause) {
			const parsedFilters = parseOnClause(onClause);
			if (parsedFilters.conditions.length > 0) {
				joinCondition = {
					mode: "filters",
					filters: parsedFilters,
				};
			}
		}

		const join: JoinedTable = {
			table: tableName,
			schema,
			type: joinType,
			columns: "all",
			joinCondition,
		};

		if (alias) {
			join.alias = alias;
		}

		joins.push(join);
	}

	return joins;
};

/**
 * Normalizes JOIN type string to standard format
 * Maps various JOIN type strings to their normalized JoinedTable type
 */
const normalizeJoinType = (joinTypeRaw: string): JoinedTable["type"] => {
	const upper = joinTypeRaw.toUpperCase().trim();
	if (upper.includes("FULL")) return "full";
	if (upper.includes("RIGHT")) return "right";
	if (upper.includes("INNER")) return "inner";
	if (upper.includes("CROSS")) return "cross";
	return "left"; // default to left
};

/**
 * @deprecated Use parseJoins instead
 */
export const parseLeftJoins = (
	sql: string,
	availableColumns: string[],
): JoinedTable[] => {
	return parseJoins(sql, availableColumns);
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
	// Supports: column IS NULL, "column" IS NULL, table.column IS NULL, "table"."column" IS NULL
	const nullMatch = condition.match(IS_NULL_REGEX);
	if (nullMatch) {
		const { column, table } = extractTableAndColumn(nullMatch[1]);
		if (availableColumns.includes(column)) {
			return {
				column,
				...(table && { table }),
				operator: nullMatch[2]
					? ("is_not_null" as const)
					: ("is_null" as const),
			};
		}
	}

	// Handle IN / NOT IN
	// Supports: column IN (...), table.column IN (...), "table"."column" IN (...)
	const inMatch = condition.match(IN_REGEX);
	if (inMatch) {
		const { column, table } = extractTableAndColumn(inMatch[1]);
		if (availableColumns.includes(column)) {
			const values = inMatch[3].split(",").map(
				(v) => v.trim().replace(/^['"]|['"]$/g, ""), // Remove quotes
			);
			return {
				column,
				...(table && { table }),
				operator: inMatch[2] ? ("not_in" as const) : ("in" as const),
				value: values,
			};
		}
	}

	// Handle LIKE / NOT LIKE with wildcards
	// Supports: column LIKE '...', table.column LIKE '...', "table"."column" LIKE '...'
	const likeMatch = condition.match(LIKE_REGEX);
	if (likeMatch) {
		const { column, table } = extractTableAndColumn(likeMatch[1]);
		if (availableColumns.includes(column)) {
			const value = likeMatch[3];
			const operator = detectLikeOperator(value, likeMatch[2] ? true : false);
			return {
				column,
				...(table && { table }),
				operator,
				value: value.replace(/%/g, ""),
			};
		}
	}

	// Handle standard comparison operators: =, !=, <>, <, >, <=, >=
	// Supports: column = value, table.column = value, "table"."column" = value
	// Must check two-character operators before single-character ones
	const comparisonMatch = condition.match(COMPARISON_REGEX);
	if (comparisonMatch) {
		const { column, table } = extractTableAndColumn(comparisonMatch[1]);
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
				...(table && { table }),
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
