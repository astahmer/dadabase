import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

/**
 * Escape SQL identifiers (table/column names)
 */
const escapeIdentifier = (identifier: string): string => {
	if (!identifier) return '""';
	if (identifier.includes(".")) {
		const parts = identifier.split(".");
		return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
	}
	return `"${identifier.replace(/"/g, '""')}"`;
};

/**
 * Escape SQL string values
 */
const escapeValue = (value: any): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "true" : "false";
	return String(value).replace(/'/g, "''");
};

/**
 * Build a WHERE clause fragment for joined table filters (PostgreSQL)
 */
export const buildPgJoinFilters = (joins: JoinedTable[]): string => {
	const joinFilterClauses: string[] = [];

	for (const join of joins) {
		if (!join.filters || join.filters.conditions.length === 0) continue;

		const validConditions = join.filters.conditions.filter((c) => {
			if (c.operator === "is_null" || c.operator === "is_not_null") return true;
			return c.value !== undefined && c.value !== null;
		});

		if (validConditions.length === 0) continue;

		const expressions = validConditions.map((c) => {
			// Prefix column with joined table name
			const col = escapeIdentifier(`${join.table}.${c.column}`);
			const isBoolValue = typeof c.value === "boolean";
			const valueStr = isBoolValue
				? String(c.value)
				: `'${escapeValue(c.value)}'`;

			switch (c.operator) {
				case "equals":
					return `${col} = ${valueStr}`;
				case "not_equals":
					return `${col} != ${valueStr}`;
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

		const joiner = join.filters.logicalOperator === "and" ? " AND " : " OR ";
		const filterClause = expressions.filter(Boolean).join(joiner);
		if (filterClause) {
			joinFilterClauses.push(`(${filterClause})`);
		}
	}

	return joinFilterClauses.length > 0 ? joinFilterClauses.join(" AND ") : "";
};

/**
 * Build a WHERE clause fragment for joined table filters (SQLite)
 */
export const buildSqliteJoinFilters = (joins: JoinedTable[]): string => {
	const joinFilterClauses: string[] = [];

	for (const join of joins) {
		if (!join.filters || join.filters.conditions.length === 0) continue;

		const validConditions = join.filters.conditions.filter((c) => {
			if (c.operator === "is_null" || c.operator === "is_not_null") return true;
			return c.value !== undefined && c.value !== null;
		});

		if (validConditions.length === 0) continue;

		const expressions = validConditions.map((c) => {
			// Prefix column with joined table name
			const col = escapeIdentifier(`${join.table}.${c.column}`);
			const sqliteValue =
				typeof c.value === "boolean" ? (c.value ? 1 : 0) : c.value;
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
					return;
			}
		});

		const joiner = join.filters.logicalOperator === "and" ? " AND " : " OR ";
		const filterClause = expressions.filter(Boolean).join(joiner);
		if (filterClause) {
			joinFilterClauses.push(`(${filterClause})`);
		}
	}

	return joinFilterClauses.length > 0 ? joinFilterClauses.join(" AND ") : "";
};

/**
 * Build WHERE clause expression from filter conditions for use in JOIN ON clauses
 */
const buildWhereExpressionFromFilters = (
	conditions: Array<{ column: string; operator: string; value?: any }>,
	logicalOperator: "and" | "or",
	schema: string,
	table: string,
): string => {
	const expressions = conditions
		.filter((c) => c && c.column)
		.map((c) => {
			const col = `"${schema}"."${table}"."${c.column}"`;

			switch (c.operator) {
				case "equals":
					return c.value === null
						? `${col} IS NULL`
						: `${col} = '${escapeValue(c.value)}'`;
				case "not_equals":
					return c.value === null
						? `${col} IS NOT NULL`
						: `${col} != '${escapeValue(c.value)}'`;
				case "contains":
					return `${col} LIKE '%${escapeValue(c.value)}%'`;
				case "not_contains":
					return `${col} NOT LIKE '%${escapeValue(c.value)}%'`;
				case "starts_with":
					return `${col} LIKE '${escapeValue(c.value)}%'`;
				case "ends_with":
					return `${col} LIKE '%${escapeValue(c.value)}'`;
				case "greater_than":
					return `${col} > ${escapeValue(c.value)}`;
				case "greater_than_or_equal":
					return `${col} >= ${escapeValue(c.value)}`;
				case "less_than":
					return `${col} < ${escapeValue(c.value)}`;
				case "less_than_or_equal":
					return `${col} <= ${escapeValue(c.value)}`;
				case "is_null":
					return `${col} IS NULL`;
				case "is_not_null":
					return `${col} IS NOT NULL`;
				case "in": {
					const values = Array.isArray(c.value) ? c.value : [c.value];
					return `${col} IN (${values.map((v) => `'${escapeValue(v)}'`).join(",")})`;
				}
				case "not_in": {
					const values = Array.isArray(c.value) ? c.value : [c.value];
					return `${col} NOT IN (${values.map((v) => `'${escapeValue(v)}'`).join(",")})`;
				}
				default:
					return;
			}
		});

	const joiner = logicalOperator === "and" ? " AND " : " OR ";
	return expressions.filter(Boolean).join(joiner);
};

/**
 * Build JOIN clauses from join configuration
 * Supports both standard FK-based joins and custom SQL join conditions
 */
export const buildJoinClauses = (
	joins: JoinedTable[],
	originalSchema: string,
	originalTable: string,
): { joinClauses: string[]; columnAliases: Map<string, string> } => {
	const joinClauses: string[] = [];
	const columnAliases = new Map<string, string>();

	for (const join of joins) {
		const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";
		const joinTableRef = `"${join.schema}"."${join.table}"`;

		// Build ON clause based on condition mode
		let joinCondition: string;

		if (join.joinCondition.mode === "standard") {
			// Standard FK-based join
			joinCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = "${originalSchema}"."${originalTable}"."${join.joinCondition.referencingColumn}"`;
		} else if (join.joinCondition.mode === "custom") {
			// Custom join condition - combine multiple expressions with AND
			const conditions = join.joinCondition.conditions
				.filter((cond) => {
					// Check if it's a JSON-stringified filter object or raw SQL
					if (cond.startsWith("{")) {
						try {
							const parsed = JSON.parse(cond);
							return parsed.conditions && parsed.conditions.length > 0;
						} catch {
							return false;
						}
					}
					return cond && cond.trim().length > 0;
				})
				.map((cond) => {
					// If it's a JSON filter object, convert to SQL
					if (cond.startsWith("{")) {
						try {
							const filterObj = JSON.parse(cond);
							return buildWhereExpressionFromFilters(
								filterObj.conditions,
								filterObj.logicalOperator || "and",
								join.schema,
								join.table,
							);
						} catch {
							return cond.trim();
						}
					}
					return cond.trim();
				});

			if (conditions.length === 0) {
				// Fallback to standard if no custom conditions provided
				joinCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = "${originalSchema}"."${originalTable}"."${join.joinCondition.referencingColumn}"`;
			} else if (conditions.length === 1) {
				joinCondition = conditions[0];
			} else {
				joinCondition = conditions.join(" AND ");
			}
		} else {
			// Filter-based join condition
			if (
				!join.joinCondition.filters ||
				join.joinCondition.filters.conditions.length === 0
			) {
				// Fallback to standard if no filters provided
				joinCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = "${originalSchema}"."${originalTable}"."${join.joinCondition.referencingColumn}"`;
			} else {
				joinCondition = buildWhereExpressionFromFilters(
					join.joinCondition.filters.conditions,
					join.joinCondition.filters.logicalOperator,
					join.schema,
					join.table,
				);
			}
		}

		joinClauses.push(`${joinType} ${joinTableRef} ON ${joinCondition}`);
	}

	return {
		joinClauses,
		columnAliases,
	};
};

/**
 * Get columns to select from joined tables with proper prefixing
 * Returns: { original_table.col1, original_table.col2, ..., joined_table.col1, ... }
 */
export const getJoinedColumnsSelection = (
	originalSchema: string,
	originalTable: string,
	originalColumns: string[],
	joins: JoinedTable[],
	joinedTableColumnsMap: Map<string, string[]>,
): string[] => {
	const selectedColumns: string[] = [];

	// Add original table columns with prefix
	for (const col of originalColumns) {
		selectedColumns.push(
			`"${originalSchema}"."${originalTable}"."${col}" as "${originalTable}.${col}"`,
		);
	}

	// Add joined table columns with prefix
	for (const join of joins) {
		const tableKey = `${join.schema}.${join.table}`;
		const availableColumns = joinedTableColumnsMap.get(tableKey) || [];

		const colsToSelect =
			join.columns === "all"
				? availableColumns
				: availableColumns.filter((c) => join.columns.includes(c));

		for (const col of colsToSelect) {
			selectedColumns.push(
				`"${join.schema}"."${join.table}"."${col}" as "${join.table}.${col}"`,
			);
		}
	}

	return selectedColumns;
};

/**
 * Post-process rows to handle joined column names
 * Converts flat result set into object with properly namespaced columns
 */
export const processJoinedRows = (
	rows: Record<string, any>[],
	originalTable: string,
	joins: JoinedTable[],
): Record<string, any>[] => {
	if (joins.length === 0) {
		return rows;
	}

	return rows.map((row) => {
		const processedRow: Record<string, any> = {};

		// Organize columns by table
		for (const [key, value] of Object.entries(row)) {
			if (key.includes(".")) {
				// Already has table prefix from alias
				processedRow[key] = value;
			} else {
				// Original table column (no prefix yet)
				processedRow[`${originalTable}.${key}`] = value;
			}
		}

		return processedRow;
	});
};
