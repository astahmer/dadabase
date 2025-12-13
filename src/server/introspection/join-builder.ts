import { SqlError } from "@effect/sql";
import type {
	CustomJoinCondition,
	FilterJoinCondition,
	JoinedTable,
	JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { LogicalOperatorType } from "#src/components/query-builder/query-filter.ts";
import { type DatabaseDialect, onDialectOrElse } from "#src/db/dialect.ts";
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
 * Get the table reference for a given schema and table name based on dialect
 */
const getTableRef = (
	schema: string,
	table: string,
	dialect: DatabaseDialect,
): string => {
	return onDialectOrElse(dialect, {
		postgres: () => `${schema}."${table}"`,
		sqlite: () => `"${table}"`,
		libsql: () => `"${table}"`,
		orElse: () => {
			throw new SqlError.SqlError({ cause: "Unsupported dialect" });
		},
	});
};

/**
 * Build FK-based join condition: originalTable.referencingColumn = joinTable.referencedColumn
 */
const buildFkCondition = (
	joinTableRef: string,
	referencedColumn: string,
	originalTableRef: string,
	referencingColumn: string,
): string => {
	return `${joinTableRef}."${referencedColumn}" = ${originalTableRef}."${referencingColumn}"`;
};

/**
 * Build filter expression based on dialect
 */
const buildFilterExpression = (
	conditions: any[],
	logicalOperator: LogicalOperatorType,
	schema: string,
	table: string,
	dialect: DatabaseDialect,
): string => {
	return (
		onDialectOrElse(dialect, {
			postgres: () =>
				buildPgWhereFragment(conditions, logicalOperator, schema, table),
			sqlite: () =>
				buildSqliteWhereFragment(conditions, logicalOperator, table),
			libsql: () =>
				buildSqliteWhereFragment(conditions, logicalOperator, table),
			orElse: () => {
				throw new SqlError.SqlError({ cause: "Unsupported dialect" });
			},
		}) || ""
	);
};

/**
 * Build ON clause for standard FK-based join
 */
const buildStandardJoinCondition = (
	join: JoinedTable,
	joinTableRef: string,
	originalTableRef: string,
): string => {
	if (
		!join.joinCondition.referencingColumn ||
		!join.joinCondition.referencedColumn
	) {
		throw new SqlError.SqlError({
			cause: `Standard join mode requires referencingColumn and referencedColumn for table ${join.table}`,
		});
	}

	return buildFkCondition(
		joinTableRef,
		join.joinCondition.referencedColumn,
		originalTableRef,
		join.joinCondition.referencingColumn,
	);
};

/**
 * Build ON clause for custom SQL join
 */
const buildCustomJoinCondition = (
	join: JoinedTable,
	joinTableRef: string,
	originalTableRef: string,
): string => {
	const conditions = (
		(join.joinCondition as CustomJoinCondition).conditions || []
	)
		.filter((cond) => cond && cond.trim().length > 0)
		.map((cond) => cond.trim());

	if (conditions.length > 0) {
		// Use custom conditions
		return conditions.join(" AND ");
	}

	// Fallback to FK if available
	if (
		join.joinCondition.referencingColumn &&
		join.joinCondition.referencedColumn
	) {
		return buildFkCondition(
			joinTableRef,
			join.joinCondition.referencedColumn,
			originalTableRef,
			join.joinCondition.referencingColumn,
		);
	}

	// No conditions and no FK info
	throw new SqlError.SqlError({
		cause: `Custom join mode requires either custom conditions or FK columns (referencingColumn, referencedColumn) for table ${join.table}`,
	});
};

/**
 * Build ON clause for filter-based join
 */
const buildFilterJoinCondition = ({
	join,
	joinTableRef,
	originalTableRef,
	dialect,
}: {
	join: JoinedTable;
	joinTableRef: string;
	originalTableRef: string;
	dialect: DatabaseDialect;
}): string => {
	const joinCondition = join.joinCondition as FilterJoinCondition;
	const hasFilters =
		joinCondition.filters && joinCondition.filters.conditions.length > 0;
	const hasFkInfo =
		joinCondition.referencingColumn && joinCondition.referencedColumn;

	// No filters and no FK info
	if (!hasFilters && !hasFkInfo) {
		throw new SqlError.SqlError({
			cause: `Filter-based join without filters requires FK columns (referencingColumn, referencedColumn) for table ${join.table}`,
		});
	}

	// No filters but has FK info
	if (!hasFilters) {
		return buildFkCondition(
			joinTableRef,
			joinCondition.referencedColumn!,
			originalTableRef,
			joinCondition.referencingColumn!,
		);
	}

	// Has filters
	const filterExpression = buildFilterExpression(
		joinCondition.filters!.conditions,
		joinCondition.filters!.logicalOperator,
		join.schema,
		join.table,
		dialect,
	);

	// Combine with FK if available
	if (hasFkInfo) {
		const fkCondition = buildFkCondition(
			joinTableRef,
			joinCondition.referencedColumn!,
			originalTableRef,
			joinCondition.referencingColumn!,
		);
		return filterExpression
			? `${fkCondition} AND ${filterExpression}`
			: fkCondition;
	}

	// Filters alone
	if (!filterExpression || filterExpression.trim() === "") {
		throw new SqlError.SqlError({
			cause: `Filter-based join has no valid filter expressions for table ${join.table}`,
		});
	}

	return filterExpression;
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
		const joinTableRef = getTableRef(join.schema, join.table, dialect);
		const originalTableRef = getTableRef(
			originalSchema,
			originalTable,
			dialect,
		);

		let joinCondition: string;
		switch (join.joinCondition.mode) {
			case "standard":
				joinCondition = buildStandardJoinCondition(
					join,
					joinTableRef,
					originalTableRef,
				);
				break;
			case "custom":
				joinCondition = buildCustomJoinCondition(
					join,
					joinTableRef,
					originalTableRef,
				);
				break;
			case "filters":
				joinCondition = buildFilterJoinCondition({
					join,
					joinTableRef,
					originalTableRef,
					dialect,
				});
				break;
			default:
				throw new SqlError.SqlError({
					cause: "Unsupported join condition mode",
				});
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
