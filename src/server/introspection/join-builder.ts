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
			if (
				!join.joinCondition.referencingColumn ||
				!join.joinCondition.referencedColumn
			) {
				throw new SqlError.SqlError({
					cause: `Standard join mode requires referencingColumn and referencedColumn for table ${join.table}`,
				});
			}

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
			// Custom join condition - can be completely independent of FK
			const conditions = join.joinCondition.conditions
				.filter((cond) => cond && cond.trim().length > 0)
				.map((cond) => cond.trim());

			if (conditions.length === 0) {
				// If no custom conditions and no FK info, this is an error
				if (
					!join.joinCondition.referencingColumn ||
					!join.joinCondition.referencedColumn
				) {
					throw new SqlError.SqlError({
						cause: `Custom join mode requires either custom conditions or FK columns (referencingColumn, referencedColumn) for table ${join.table}`,
					});
				}
				// Fallback to FK join if FK info is provided
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
				// Use the custom conditions as-is (no FK fallback)
				joinCondition = conditions.join(" AND ");
			}
		} else {
			// Filter-based join condition - FK is optional if no filters are provided
			if (
				!join.joinCondition.filters ||
				join.joinCondition.filters.conditions.length === 0
			) {
				// No filters - must have FK info
				if (
					!join.joinCondition.referencingColumn ||
					!join.joinCondition.referencedColumn
				) {
					throw new SqlError.SqlError({
						cause: `Filter-based join without filters requires FK columns (referencingColumn, referencedColumn) for table ${join.table}`,
					});
				}

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
				// Has filters
				if (
					join.joinCondition.referencingColumn &&
					join.joinCondition.referencedColumn
				) {
					// FK info available - combine with filters
					const originalTableRef = onDialectOrElse(dialect, {
						postgres: () => `${originalSchema}."${originalTable}"`,
						sqlite: () => `"${originalTable}"`,
						libsql: () => `"${originalTable}"`,
						orElse: () => {
							throw new SqlError.SqlError({ cause: "Unsupported dialect" });
						},
					});

					const fkCondition = `${joinTableRef}."${join.joinCondition.referencedColumn}" = ${originalTableRef}."${join.joinCondition.referencingColumn}"`;
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

					if (!filterExpression || filterExpression.trim() === "") {
						joinCondition = fkCondition;
					} else {
						joinCondition = `${fkCondition} AND ${filterExpression}`;
					}
				} else {
					// No FK info - use filters alone as the join condition
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

					if (!filterExpression || filterExpression.trim() === "") {
						throw new SqlError.SqlError({
							cause: `Filter-based join has no valid filter expressions for table ${join.table}`,
						});
					}
					joinCondition = filterExpression;
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
 * Helper function to build SELECT clause with joined table columns
 * Abstracted to support both PostgreSQL and SQLite with different quoting/prefixing rules
 */
const buildSelectWithJoinsGeneric = (
	schema: string,
	table: string,
	joins: JoinTablesConfig["joins"],
	tableColumnsMap: Map<string, { name: string }[]>,
	formatters: {
		baseTableRef: (schema: string, table: string) => string;
		baseTableKey: (schema: string, table: string) => string;
		joinTableRef: (schema: string, table: string) => string;
		joinTableKey: (schema: string, table: string) => string;
	},
): string => {
	const columns: string[] = [];
	const baseTableRef = formatters.baseTableRef(schema, table);
	const baseTableKey = formatters.baseTableKey(schema, table);

	// Add original table columns with dot-delimited aliases
	const baseTableColumns = tableColumnsMap.get(baseTableKey) || [];
	if (baseTableColumns.length > 0) {
		const baseCols = baseTableColumns
			.map((col) => `${baseTableRef}."${col.name}" as "${table}.${col.name}"`)
			.join(", ");
		columns.push(baseCols);
	} else {
		// Fallback to * if columns not available
		columns.push(`${baseTableRef}.*`);
	}

	// Add joined table columns
	for (const join of joins) {
		const joinTableRef = formatters.joinTableRef(join.schema, join.table);
		const joinTableKey = formatters.joinTableKey(join.schema, join.table);
		const joinedTableColumns = tableColumnsMap.get(joinTableKey) || [];

		if (join.columns === "all") {
			if (joinedTableColumns.length > 0) {
				const joinedCols = joinedTableColumns
					.map(
						(col) =>
							`${joinTableRef}."${col.name}" as "${join.table}.${col.name}"`,
					)
					.join(", ");
				columns.push(joinedCols);
			} else {
				// Fallback to * if columns not available
				columns.push(`${joinTableRef}.*`);
			}
		} else {
			const selectedCols = join.columns
				.map((col) => `${joinTableRef}."${col}" as "${join.table}.${col}"`)
				.join(", ");
			columns.push(selectedCols);
		}
	}

	return columns.join(", ");
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
	return buildSelectWithJoinsGeneric(schema, table, joins, tableColumnsMap, {
		baseTableRef: (s, t) => `${s}."${t}"`,
		baseTableKey: (s, t) => `${s}.${t}`,
		joinTableRef: (s, t) => `${s}."${t}"`,
		joinTableKey: (s, t) => `${s}.${t}`,
	});
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
	return buildSelectWithJoinsGeneric(
		"", // schema not used in SQLite
		table,
		joins,
		tableColumnsMap,
		{
			baseTableRef: (_s, t) => `"${t}"`,
			baseTableKey: (_s, t) => t,
			joinTableRef: (_s, t) => `"${t}"`,
			joinTableKey: (_s, t) => t,
		},
	);
};
