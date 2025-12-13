import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import { escapeIdentifier, escapeValue } from "./escape-value";

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
				.filter((cond) => cond && cond.trim().length > 0)
				.map((cond) => cond.trim());

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
				const filterExpression = buildWhereExpressionFromFilters(
					join.joinCondition.filters.conditions,
					join.joinCondition.filters.logicalOperator,
					join.schema,
					join.table,
				);
				// If no valid filter conditions, fallback to standard FK-based join
				if (!filterExpression || filterExpression.trim() === "") {
					joinCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = "${originalSchema}"."${originalTable}"."${join.joinCondition.referencingColumn}"`;
				} else {
					joinCondition = filterExpression;
				}
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

/**
 * Convert filter conditions to SQL WHERE expression with proper schema/table prefixing
 * This is the shared implementation used by both frontend and backend.
 *
 * @param conditions Filter conditions to convert
 * @param logicalOperator How to combine multiple conditions (AND or OR)
 * @param schema Schema name for column prefixing
 * @param table Table name for column prefixing
 * @returns SQL expression string, e.g., "quantity = '1' AND status = 'active'"
 */
export const buildWhereExpressionFromFilters = (
	conditions: Array<{ column: string; operator: string; value?: any }>,
	logicalOperator: "and" | "or",
	schema: string,
	table: string,
): string => {
	const expressions = conditions
		.filter((c) => c && c.column)
		.map((c) => {
			const col = `"${schema}"."${table}"."${c.column}"`;
			// Check if value is boolean and don't quote it
			const isBoolValue = typeof c.value === "boolean";
			const valueStr = isBoolValue
				? c.value
					? "true"
					: "false"
				: `'${escapeValue(c.value)}'`;

			switch (c.operator) {
				case "equals":
					return c.value === null ? `${col} IS NULL` : `${col} = ${valueStr}`;
				case "not_equals":
					return c.value === null
						? `${col} IS NOT NULL`
						: `${col} != ${valueStr}`;
				case "contains":
					return `${col} LIKE '%${escapeValue(c.value)}%'`;
				case "not_contains":
					return `${col} NOT LIKE '%${escapeValue(c.value)}%'`;
				case "starts_with":
					return `${col} LIKE '${escapeValue(c.value)}%'`;
				case "ends_with":
					return `${col} LIKE '%${escapeValue(c.value)}'`;
				case "greater_than":
					return `${col} > ${valueStr}`;
				case "greater_than_or_equal":
					return `${col} >= ${valueStr}`;
				case "less_than":
					return `${col} < ${valueStr}`;
				case "less_than_or_equal":
					return `${col} <= ${valueStr}`;
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
					return "";
			}
		})
		.filter((expr): expr is string => expr !== "");

	// If no valid expressions, return empty string (caller should handle fallback)
	const joiner = logicalOperator === "and" ? " AND " : " OR ";
	return expressions.join(joiner);
};

/**
 * Build SQL JOIN clauses from join configuration for a specific dialect
 * Supports three join condition modes: standard (FK-based), custom (SQL expressions), and filters (QueryFilterBuilder)
 *
 * @param joins Array of joined table configurations
 * @param originalSchema Schema of the original table
 * @param originalTable Name of the original table
 * @param dialect SQL dialect - "postgres" or "sqlite"
 * @returns Array of JOIN clause SQL strings
 */
export const buildJoinSqlClauses = (
	joins: JoinedTable[],
	originalSchema: string,
	originalTable: string,
	dialect: "postgres" | "sqlite" = "postgres",
): string[] => {
	return joins.map((join) => {
		const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";

		// Build the table reference based on dialect
		const joinTableRef =
			dialect === "postgres"
				? `${join.schema}."${join.table}"`
				: `"${join.table}"`;

		// Build ON clause based on condition mode
		let joinCondition: string;

		if (join.joinCondition.mode === "standard") {
			// Standard FK-based join
			const originalTableRef =
				dialect === "postgres"
					? `${originalSchema}."${originalTable}"`
					: `"${originalTable}"`;

			joinCondition =
				dialect === "postgres"
					? `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`
					: `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;
		} else if (join.joinCondition.mode === "custom") {
			// Custom join condition - combine multiple expressions with AND
			const conditions = join.joinCondition.conditions
				.filter((cond) => cond && cond.trim().length > 0)
				.map((cond) => cond.trim());

			if (conditions.length === 0) {
				// Fallback to standard if no custom conditions provided
				const originalTableRef =
					dialect === "postgres"
						? `${originalSchema}."${originalTable}"`
						: `"${originalTable}"`;

				joinCondition =
					dialect === "postgres"
						? `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`
						: `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;
			} else {
				joinCondition = conditions.join(" AND ");
			}
		} else {
			// Filter-based join condition - combine FK condition with filter conditions
			const originalTableRef =
				dialect === "postgres"
					? `${originalSchema}."${originalTable}"`
					: `"${originalTable}"`;

			const fkCondition =
				dialect === "postgres"
					? `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`
					: `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;

			if (
				!join.joinCondition.filters ||
				join.joinCondition.filters.conditions.length === 0
			) {
				// No filters, just use FK condition
				joinCondition = fkCondition;
			} else {
				const filterExpression = buildWhereExpressionFromFilters(
					join.joinCondition.filters.conditions,
					join.joinCondition.filters.logicalOperator,
					join.schema,
					join.table,
				);

				// If no valid filter conditions, fallback to FK condition
				if (!filterExpression || filterExpression.trim() === "") {
					joinCondition = fkCondition;
				} else {
					joinCondition = `${fkCondition} AND ${filterExpression}`;
				}
			}
		}

		return `${joinType} ${joinTableRef} ON ${joinCondition}`;
	});
};

/**
 * Build a complete SELECT statement with JOINs for preview purposes
 * Returns the SQL that will be executed (without WHERE/ORDER/LIMIT clauses)
 */
export const buildJoinSqlPreview = (
	schema: string,
	table: string,
	joins: JoinedTable[],
	dialect: "postgres" | "sqlite" = "postgres",
): string => {
	const tableRef =
		dialect === "postgres" ? `${schema}."${table}"` : `"${table}"`;

	// Build select clause with all columns from all tables
	const selectParts = [`SELECT ${tableRef}.*`];

	for (const join of joins) {
		const joinTableRef =
			dialect === "postgres"
				? `${join.schema}."${join.table}"`
				: `"${join.table}"`;
		selectParts.push(`${joinTableRef}.*`);
	}

	const selectClause = selectParts.join(", ");

	// Build FROM clause
	const fromClause = `FROM ${tableRef}`;

	// Build JOIN clauses
	const joinClauses = buildJoinSqlClauses(joins, schema, table, dialect);
	const joinClausesText =
		joinClauses.length > 0 ? `\n${joinClauses.join("\n")}` : "";

	return `${selectClause}\n${fromClause}${joinClausesText}`;
};

/**
 * Build a human-readable summary of configured joins
 * Example output:
 * "1. public.lineItems [LEFT standard FK]
 *  2. public.products [INNER filters (2 conditions)]"
 */
export const buildJoinSummary = (joins: JoinedTable[]): string => {
	if (joins.length === 0) {
		return "No joins configured";
	}

	return joins
		.map((join, index) => {
			const joinType = join.type === "left" ? "LEFT" : "INNER";

			let modeDesc: string;
			if (join.joinCondition.mode === "standard") {
				modeDesc = "standard FK";
			} else if (join.joinCondition.mode === "custom") {
				const condCount = join.joinCondition.conditions?.length ?? 0;
				modeDesc =
					condCount === 1
						? `custom (${condCount} condition)`
						: `custom (${condCount} conditions)`;
			} else {
				const condCount = join.joinCondition.filters?.conditions?.length ?? 0;
				modeDesc =
					condCount === 1
						? `filters (${condCount} condition)`
						: `filters (${condCount} conditions)`;
			}

			return `${index + 1}. ${join.schema}.${join.table} [${joinType} ${modeDesc}]`;
		})
		.join("\n");
};
