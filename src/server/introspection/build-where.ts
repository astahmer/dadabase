import type {
	LogicalOperatorType,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { escapeIdentifier, escapeValue } from "./escape-value";

/**
 * Build a WHERE clause fragment for main table filters (PostgreSQL)
 * Supports specifying table in condition for joined table filters
 * If condition.table is provided, it takes precedence over the default schema/table
 */
export const buildPgWhereFragment = (
	conditions: QueryFilterType["conditions"],
	logicalOp: LogicalOperatorType,
	schema?: string,
	table?: string,
): string | undefined => {
	if (conditions.length === 0) return;

	const validConditions = conditions.filter((c) => {
		if (c.operator === "is_null" || c.operator === "is_not_null") return true;
		return c.value !== undefined && c.value !== null;
	});

	if (validConditions.length === 0) return;

	const expressions = validConditions.map((c) => {
		// If condition specifies a table, use it. Otherwise use the provided schema/table or just the column
		let col: string;
		if (c.table) {
			// Explicit table in condition (for joined tables)
			col = `${escapeIdentifier(c.table)}.${escapeIdentifier(c.column)}`;
		} else if (schema !== undefined && table) {
			// Use provided schema and table (schema can be empty string for default schema)
			col = schema
				? `${escapeIdentifier(schema)}.${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`
				: `${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`;
		} else {
			// Just the column name
			col = `${escapeIdentifier(c.column)}`;
		}

		const inverted = c.inverted ?? false;
		let baseClause: string;

		switch (c.operator) {
			case "equals":
				baseClause = `${col} = '${escapeValue(c.value)}'`;
				break;
			case "not_equals":
				baseClause = `${col} != '${escapeValue(c.value)}'`;
				break;
			case "contains":
				baseClause = `${col} ILIKE '%${escapeValue(c.value)}%'`;
				break;
			case "not_contains":
				baseClause = `${col} NOT ILIKE '%${escapeValue(c.value)}%'`;
				break;
			case "starts_with":
				baseClause = `${col} ILIKE '${escapeValue(c.value)}%'`;
				break;
			case "ends_with":
				baseClause = `${col} ILIKE '%${escapeValue(c.value)}'`;
				break;
			case "greater_than":
				baseClause = `${col} > '${escapeValue(c.value)}'`;
				break;
			case "greater_than_or_equal":
				baseClause = `${col} >= '${escapeValue(c.value)}'`;
				break;
			case "less_than":
				baseClause = `${col} < '${escapeValue(c.value)}'`;
				break;
			case "less_than_or_equal":
				baseClause = `${col} <= '${escapeValue(c.value)}'`;
				break;
			case "is_null":
				baseClause = `${col} IS NULL`;
				break;
			case "is_not_null":
				baseClause = `${col} IS NOT NULL`;
				break;
			case "in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				baseClause = `${col} = ANY(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
				break;
			}
			case "not_in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				baseClause = `${col} != ALL(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
				break;
			}
			default:
				const _exhaustive: never = c.operator;
				return _exhaustive;
		}

		// Apply inversion with NOT if needed (for operators like NOT LIKE, NOT (...))
		return inverted ? `NOT (${baseClause})` : baseClause;
	});

	const joiner = logicalOp === "and" ? " AND " : " OR ";
	return expressions.filter(Boolean).join(joiner);
};

/**
 * Build a WHERE clause fragment for main table filters (SQLite)
 * Supports specifying table in condition for joined table filters
 * If condition.table is provided, it takes precedence over the default table
 */
export const buildSqliteWhereFragment = (
	conditions: QueryFilterType["conditions"],
	logicalOp: LogicalOperatorType,
	table?: string,
): string => {
	if (conditions.length === 0) return "";

	const validConditions = conditions.filter((c) => {
		if (c.operator === "is_null" || c.operator === "is_not_null") return true;
		return c.value !== undefined && c.value !== null;
	});

	if (validConditions.length === 0) return "";

	const expressions = validConditions.map((c) => {
		// If condition specifies a table, use it. Otherwise use the provided table or just the column
		let col: string;
		if (c.table) {
			// Explicit table in condition (for joined tables)
			col = `${escapeIdentifier(c.table)}.${escapeIdentifier(c.column)}`;
		} else if (table) {
			// Use provided table
			col = `${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`;
		} else {
			// Just the column name
			col = `${escapeIdentifier(c.column)}`;
		}

		// Convert boolean values to integers for SQLite (0/1 instead of false/true)
		const sqliteValue =
			typeof c.value === "boolean" ? (c.value ? 1 : 0) : c.value;
		// Helper function to format values - numbers without quotes, strings with quotes
		const formatValue = (val: any): string => {
			if (typeof val === "number") return String(val);
			return `'${escapeValue(val)}'`;
		};

		const inverted = c.inverted ?? false;
		let baseClause: string;

		switch (c.operator) {
			case "equals":
				baseClause = `${col} = ${formatValue(sqliteValue)}`;
				break;
			case "not_equals":
				baseClause = `${col} != ${formatValue(sqliteValue)}`;
				break;
			case "contains":
				// SQLite uses LIKE (case-insensitive with COLLATE NOCASE)
				baseClause = `${col} LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
				break;
			case "starts_with":
				baseClause = `${col} LIKE '${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
				break;
			case "not_contains":
				baseClause = `${col} NOT LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
				break;
			case "ends_with":
				baseClause = `${col} LIKE '%${escapeValue(sqliteValue)}' COLLATE NOCASE`;
				break;
			case "greater_than":
				baseClause = `${col} > ${formatValue(sqliteValue)}`;
				break;
			case "greater_than_or_equal":
				baseClause = `${col} >= ${formatValue(sqliteValue)}`;
				break;
			case "less_than":
				baseClause = `${col} < ${formatValue(sqliteValue)}`;
				break;
			case "less_than_or_equal":
				baseClause = `${col} <= ${formatValue(sqliteValue)}`;
				break;
			case "is_null":
				baseClause = `${col} IS NULL`;
				break;
			case "is_not_null":
				baseClause = `${col} IS NOT NULL`;
				break;
			case "in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				const sqliteValues = values.map((v) =>
					typeof v === "boolean" ? (v ? 1 : 0) : v,
				);
				baseClause = `${col} IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
				break;
			}
			case "not_in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				const sqliteValues = values.map((v) =>
					typeof v === "boolean" ? (v ? 1 : 0) : v,
				);
				baseClause = `${col} NOT IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
				break;
			}
			default:
				const _exhaustive: never = c.operator;
				return _exhaustive;
		}

		// Apply inversion with NOT if needed (for operators like NOT LIKE, NOT (...))
		return inverted ? `NOT (${baseClause})` : baseClause;
	});

	const joiner = logicalOp === "and" ? " AND " : " OR ";
	return expressions.filter(Boolean).join(joiner);
};
