import type {
	JoinedTable,
	JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import { onDialectOrElse, type DatabaseDialect } from "#src/db/dialect.ts";
import { SqlError } from "@effect/sql";
import {
	buildPgWhereFragment,
	buildSqliteWhereFragment,
} from "./build-where.ts";

/**
 * Build a WHERE clause fragment for joined table filters (PostgreSQL)
 */
export const buildPgJoinFilters = (joins: JoinedTable[]): string => {
	const joinFilterClauses: string[] = [];

	for (const join of joins) {
		if (!join.filters || join.filters.conditions.length === 0) continue;

		const filterClause = buildPgWhereFragment(
			join.filters.conditions,
			join.filters.logicalOperator,
			join.schema,
			join.table,
		);
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

		const filterClause = buildSqliteWhereFragment(
			join.filters.conditions,
			join.filters.logicalOperator,
			join.table,
		);
		if (filterClause) {
			joinFilterClauses.push(`(${filterClause})`);
		}
	}

	return joinFilterClauses.length > 0 ? joinFilterClauses.join(" AND ") : "";
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
	dialect: DatabaseDialect,
): string[] => {
	return joins.map((join) => {
		const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";

		// Build the table reference based on dialect
		const joinTableRef = onDialectOrElse(dialect, {
			postgres: () => `${join.schema}."${join.table}"`,
			sqlite: () => `"${join.table}"`,
			libsql: () => `"${join.table}"`,
			orElse: () => {
				throw new SqlError.SqlError({ cause: "Unsupported dialect" });
			},
		});

		// Build ON clause based on condition mode
		let joinCondition: string;

		if (join.joinCondition.mode === "standard") {
			// Standard FK-based join
			const originalTableRef = onDialectOrElse(dialect, {
				postgres: () => `${originalSchema}."${originalTable}"`,
				sqlite: () => `"${originalTable}"`,
				libsql: () => `"${originalTable}"`,
				orElse: () => {
					throw new SqlError.SqlError({ cause: "Unsupported dialect" });
				},
			});

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
				const originalTableRef = onDialectOrElse(dialect, {
					postgres: () => `${originalSchema}."${originalTable}"`,
					sqlite: () => `"${originalTable}"`,
					libsql: () => `"${originalTable}"`,
					orElse: () => {
						throw new SqlError.SqlError({ cause: "Unsupported dialect" });
					},
				});
				joinCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;
			} else {
				joinCondition = conditions.join(" AND ");
			}
		} else {
			// Filter-based join condition - combine FK condition with filter conditions
			const originalTableRef = onDialectOrElse(dialect, {
				postgres: () => `${originalSchema}."${originalTable}"`,
				sqlite: () => `"${originalTable}"`,
				libsql: () => `"${originalTable}"`,
				orElse: () => {
					throw new SqlError.SqlError({ cause: "Unsupported dialect" });
				},
			});

			const fkCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;

			if (
				!join.joinCondition.filters ||
				join.joinCondition.filters.conditions.length === 0
			) {
				// No filters, just use FK condition
				joinCondition = fkCondition;
			} else {
				const conditions = join.joinCondition.filters.conditions;
				const logicalOperator = join.joinCondition.filters.logicalOperator;
				const filterExpression = onDialectOrElse(dialect, {
					postgres: () =>
						buildPgWhereFragment(
							conditions,
							logicalOperator,
							join.schema,
							join.table,
						),
					sqlite: () =>
						buildSqliteWhereFragment(conditions, logicalOperator, join.table),
					libsql: () =>
						buildSqliteWhereFragment(conditions, logicalOperator, join.table),
					orElse: () => {
						throw new SqlError.SqlError({ cause: "Unsupported dialect" });
					},
				});

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
	dialect: DatabaseDialect,
): string => {
	const tableRef = onDialectOrElse(dialect, {
		postgres: () => `${schema}."${table}"`,
		sqlite: () => `"${table}"`,
		libsql: () => `"${table}"`,
		orElse: () => {
			throw new SqlError.SqlError({ cause: "Unsupported dialect" });
		},
	});

	// Build select clause with all columns from all tables
	const selectParts = [`SELECT ${tableRef}.*`];

	for (const join of joins) {
		const joinTableRef = onDialectOrElse(dialect, {
			postgres: () => `${join.schema}."${join.table}"`,
			sqlite: () => `"${join.table}"`,
			libsql: () => `"${join.table}"`,
			orElse: () => {
				throw new SqlError.SqlError({ cause: "Unsupported dialect" });
			},
		});
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
 * Build SELECT clause with joined table columns for PostgreSQL
 * Explicitly selects and aliases all columns with table prefix (e.g., "table.column")
 */
export const buildPgSelectWithJoins = (
	schema: string,
	table: string,
	joins: JoinTablesConfig["joins"],
	tableColumnsMap: Map<string, { name: string }[]>,
): string => {
	const columns: string[] = [];

	// Add original table columns with dot-delimited aliases
	const baseTableColumns = tableColumnsMap.get(`${schema}.${table}`) || [];
	if (baseTableColumns.length > 0) {
		const baseCols = baseTableColumns
			.map(
				(col) => `${schema}."${table}"."${col.name}" as "${table}.${col.name}"`,
			)
			.join(", ");
		columns.push(baseCols);
	} else {
		// Fallback to * if columns not available
		columns.push(`${schema}."${table}".*`);
	}

	// Add joined table columns
	for (const join of joins) {
		const joinKey = `${join.schema}.${join.table}`;
		const joinedTableColumns = tableColumnsMap.get(joinKey) || [];

		if (join.columns === "all") {
			if (joinedTableColumns.length > 0) {
				const joinedCols = joinedTableColumns
					.map(
						(col) =>
							`${join.schema}."${join.table}"."${col.name}" as "${join.table}.${col.name}"`,
					)
					.join(", ");
				columns.push(joinedCols);
			} else {
				// Fallback to * if columns not available
				columns.push(`${join.schema}."${join.table}".*`);
			}
		} else {
			const selectedCols = join.columns
				.map(
					(col) =>
						`${join.schema}."${join.table}"."${col}" as "${join.table}.${col}"`,
				)
				.join(", ");
			columns.push(selectedCols);
		}
	}

	return columns.join(", ");
};

/**
 * Build SELECT clause with joined table columns for SQLite
 * Explicitly selects and aliases all columns with table prefix (e.g., "table.column")
 */
export const buildSqliteSelectWithJoins = (
	table: string,
	joins: JoinTablesConfig["joins"],
	tableColumnsMap: Map<string, { name: string }[]>,
): string => {
	const columns: string[] = [];

	// Add original table columns with dot-delimited aliases
	const baseTableColumns = tableColumnsMap.get(table) || [];
	if (baseTableColumns.length > 0) {
		const baseCols = baseTableColumns
			.map((col) => `"${table}"."${col.name}" as "${table}.${col.name}"`)
			.join(", ");
		columns.push(baseCols);
	} else {
		// Fallback to * if columns not available
		columns.push(`"${table}".*`);
	}

	// Add joined table columns
	for (const join of joins) {
		const joinKey = join.table;
		const joinedTableColumns = tableColumnsMap.get(joinKey) || [];

		if (join.columns === "all") {
			if (joinedTableColumns.length > 0) {
				const joinedCols = joinedTableColumns
					.map(
						(col) =>
							`"${join.table}"."${col.name}" as "${join.table}.${col.name}"`,
					)
					.join(", ");
				columns.push(joinedCols);
			} else {
				// Fallback to * if columns not available
				columns.push(`"${join.table}".*`);
			}
		} else {
			const selectedCols = join.columns
				.map((col) => `"${join.table}"."${col}" as "${join.table}.${col}"`)
				.join(", ");
			columns.push(selectedCols);
		}
	}

	return columns.join(", ");
};
