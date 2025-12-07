import { sql } from "@effect/sql";
import type { Statement } from "@effect/sql";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types";

/**
 * Build JOIN clauses from join configuration
 * Supports both PostgreSQL and SQLite syntax
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
		const joinTableRef = `${join.schema}.${join.table}`;
		const joinCondition = `${joinTableRef}.${join.referencedColumn} = ${originalSchema}.${originalTable}.${join.referencingColumn}`;

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
			`${originalSchema}.${originalTable}.${col} as "${originalTable}.${col}"`,
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
				`${join.schema}.${join.table}.${col} as "${join.table}.${col}"`,
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
