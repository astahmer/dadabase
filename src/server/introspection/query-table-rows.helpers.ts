import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";

/**
 * Remaps schema names to empty string if they match the default schema.
 * This normalizes schema references for consistent SQL generation.
 */
export const remapSchema = (schema: string, defaultSchema: string): string =>
  schema === defaultSchema ? "" : schema;

/**
 * Remaps joins to use empty string for default schemas.
 * Preserves all other properties of the join.
 */
export const remapJoins = (joins: JoinedTable[], defaultSchema: string): JoinedTable[] =>
  joins.map((j) => ({
    ...j,
    schema: remapSchema(j.schema, defaultSchema),
    joinFrom: j.joinFrom
      ? {
          ...j.joinFrom,
          schema: remapSchema(j.joinFrom.schema, defaultSchema),
        }
      : undefined,
  }));

/**
 * Formats a schema.table identifier, returning just the table name
 * if schema is empty (default schema case).
 */
export const formatSchemaTable = (schema: string, table: string): string => {
  return !schema ? table : `${schema}.${table}`;
};

/**
 * Builds qualified column name (e.g., "table.column")
 */
export const getQualifiedName = (tableOrAlias: string, columnName: string): string =>
  `${tableOrAlias}.${columnName}`;

export interface TableColumnResult {
  schemaTable: string;
  tableOnly: string;
  columns: Array<{ name: string }>;
}

/**
 * Determines if columns should be filtered based on selectedColumns/excludedColumns.
 * - Always filter base table (index 0)
 * - Only filter joined tables if selectedColumns/excludedColumns have qualified names (e.g., "table.column")
 */
export const shouldFilterColumns = (isBaseTable: boolean, hasQualifiedColumns: boolean): boolean =>
  isBaseTable || hasQualifiedColumns;

/**
 * Filters column list based on selectedColumns or excludedColumns.
 * - Whitelist mode: if selectedColumns is provided, only include those
 * - Blacklist mode: if excludedColumns is provided, exclude those
 * - No filtering: return all columns
 */
export const filterTableColumns = (
  columns: Array<{ name: string }>,
  tableOnly: string,
  selectedColumns: string[],
  excludedColumns: string[],
  hasQualifiedColumns: boolean,
): Array<{ name: string }> => {
  if (selectedColumns.length === 0 && excludedColumns.length === 0) {
    return columns;
  }

  if (selectedColumns.length > 0) {
    // Whitelist mode
    return columns.filter((col) => {
      const colKey = hasQualifiedColumns ? getQualifiedName(tableOnly, col.name) : col.name;
      return selectedColumns.includes(colKey);
    });
  }

  if (excludedColumns.length > 0) {
    // Blacklist mode
    return columns.filter((col) => {
      const colKey = hasQualifiedColumns ? getQualifiedName(tableOnly, col.name) : col.name;
      return !excludedColumns.includes(colKey);
    });
  }

  return columns;
};

/**
 * Builds a map of table identifiers to their columns.
 * - Base table (index 0): Always filtered by selectedColumns/excludedColumns
 * - Joined tables: Only filtered if selectedColumns/excludedColumns have qualified names (e.g., "users.name")
 * Stores both schema.table and table-only keys for lookup compatibility.
 */
export const buildTableColumnsMap = (
  columnResults: TableColumnResult[],
  selectedColumns: string[],
  excludedColumns: string[],
): Map<string, Array<{ name: string }>> => {
  const hasQualifiedColumns =
    selectedColumns.some((col) => col.includes(".")) ||
    excludedColumns.some((col) => col.includes("."));

  const tableColumnsMap = new Map<string, Array<{ name: string }>>();

  for (let tableIndex = 0; tableIndex < columnResults.length; tableIndex++) {
    const result = columnResults[tableIndex];
    const isBaseTable = tableIndex === 0;

    // Only apply selectedColumns/excludedColumns filtering if:
    // 1. It's the base table, OR
    // 2. There are qualified column names (e.g., "users.name") that could apply to any table
    const shouldFilter = shouldFilterColumns(isBaseTable, hasQualifiedColumns);

    const filteredColumns = shouldFilter
      ? filterTableColumns(
          result.columns,
          result.tableOnly,
          selectedColumns,
          excludedColumns,
          hasQualifiedColumns,
        )
      : result.columns;

    tableColumnsMap.set(result.schemaTable, filteredColumns);
    tableColumnsMap.set(result.tableOnly, filteredColumns);
  }

  return tableColumnsMap;
};

export interface BuildColumnListInput {
  columnResults: TableColumnResult[];
  baseTable: string;
  joins: JoinedTable[];
  joinAliases: Map<number, string>;
  tableColumnsMap: Map<string, Array<{ name: string }>>;
}

/**
 * Builds the final column list for the SQL SELECT clause.
 * Handles:
 * - Base table columns (with/without prefix based on joins)
 * - Joined table columns (with aliases and specific column selection)
 */
export const buildColumnList = (input: BuildColumnListInput): string[] => {
  const { columnResults, baseTable, joins, joinAliases, tableColumnsMap } = input;

  return columnResults.flatMap((r, tableIndex) => {
    // tableIndex 0 = base table, tableIndex 1+ = joined tables
    if (tableIndex === 0) {
      // Base table - apply column filtering
      const baseTableColumns = tableColumnsMap.get(r.schemaTable) || r.columns;
      if (joins.length === 0) {
        // No joins: return columns without prefix
        return baseTableColumns.map((c) => c.name);
      }
      // With joins: always include base table columns with prefix
      return baseTableColumns.map((c) => `${baseTable}.${c.name}`);
    }

    // Joined tables: use their full column list with alias/table prefix
    const joinIndex = tableIndex - 1; // Convert to join array index
    const alias = joinAliases.get(joinIndex) || r.tableOnly;

    // Get filtered columns from tableColumnsMap (already respects selectedColumns/excludedColumns)
    const filteredColumns = tableColumnsMap.get(r.schemaTable) || r.columns;

    // For joined tables, also respect their column configuration if present
    const joinConfig = joins[joinIndex];
    let columnsToUse = filteredColumns;

    if (joinConfig && joinConfig.columns && joinConfig.columns !== "all") {
      // Join has specific column selection - apply both join config AND global filtering
      columnsToUse = filteredColumns.filter((col) =>
        (joinConfig.columns as string[]).includes(col.name),
      );
    }

    return columnsToUse.map((c) => `${alias}.${c.name}`);
  });
};
