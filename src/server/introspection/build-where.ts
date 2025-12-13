import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { escapeIdentifier, escapeValue } from "./escape-value";

/**
 * Build a WHERE clause fragment for main table filters (PostgreSQL)
 * Supports specifying table in condition for joined table filters
 * If condition.table is provided, it takes precedence over the default schema/table
 */
export const buildPgWhereFragment = (
	conditions: QueryFilterType["conditions"],
	logicalOp: "and" | "or",
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
		} else if (schema && table) {
			// Use provided schema and table
			col = `${escapeIdentifier(schema)}.${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`;
		} else {
			// Just the column name
			col = `${escapeIdentifier(c.column)}`;
		}

		switch (c.operator) {
			case "equals":
				return `${col} = '${escapeValue(c.value)}'`;
			case "not_equals":
				return `${col} != '${escapeValue(c.value)}'`;
			case "contains":
				return `${col} ILIKE '%${escapeValue(c.value)}%'`;
			case "not_contains":
				return `${col} NOT ILIKE '%${escapeValue(c.value)}%'`;
			case "starts_with":
				return `${col} ILIKE '${escapeValue(c.value)}%'`;
			case "ends_with":
				return `${col} ILIKE '%${escapeValue(c.value)}'`;
			case "greater_than":
				return `${col} > '${escapeValue(c.value)}'`;
			case "greater_than_or_equal":
				return `${col} >= '${escapeValue(c.value)}'`;
			case "less_than":
				return `${col} < '${escapeValue(c.value)}'`;
			case "less_than_or_equal":
				return `${col} <= '${escapeValue(c.value)}'`;
			case "is_null":
				return `${col} IS NULL`;
			case "is_not_null":
				return `${col} IS NOT NULL`;
			case "in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				return `${col} = ANY(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
			}
			case "not_in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				return `${col} != ALL(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
			}
			default:
				return;
		}
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
	logicalOp: "and" | "or",
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

		switch (c.operator) {
			case "equals":
				return `${col} = ${formatValue(sqliteValue)}`;
			case "not_equals":
				return `${col} != ${formatValue(sqliteValue)}`;
			case "contains":
				// SQLite uses LIKE (case-insensitive with COLLATE NOCASE)
				return `${col} LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
			case "not_contains":
				return `${col} NOT LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
			case "starts_with":
				return `${col} LIKE '${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
			case "ends_with":
				return `${col} LIKE '%${escapeValue(sqliteValue)}' COLLATE NOCASE`;
			case "greater_than":
				return `${col} > ${formatValue(sqliteValue)}`;
			case "greater_than_or_equal":
				return `${col} >= ${formatValue(sqliteValue)}`;
			case "less_than":
				return `${col} < ${formatValue(sqliteValue)}`;
			case "less_than_or_equal":
				return `${col} <= ${formatValue(sqliteValue)}`;
			case "is_null":
				return `${col} IS NULL`;
			case "is_not_null":
				return `${col} IS NOT NULL`;
			case "in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				const sqliteValues = values.map((v) =>
					typeof v === "boolean" ? (v ? 1 : 0) : v,
				);
				return `${col} IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
			}
			case "not_in": {
				const values = Array.isArray(c.value) ? c.value : [c.value];
				const sqliteValues = values.map((v) =>
					typeof v === "boolean" ? (v ? 1 : 0) : v,
				);
				return `${col} NOT IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
			}
			default:
				return "";
		}
	});

	const joiner = logicalOp === "and" ? " AND " : " OR ";
	return expressions.filter(Boolean).join(joiner);
};
