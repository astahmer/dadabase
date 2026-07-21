import { SqlError } from "@effect/sql";

// oxlint-disable typescript/no-non-null-assertion
import type {
  CustomJoinCondition,
  FilterJoinCondition,
  JoinedTable,
  JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { LogicalOperatorType } from "#src/components/query-builder/query-filter.ts";

import { DatabaseDialect, onDialectOrElse } from "#src/db/dialect.ts";

import {
  buildMysqlWhereFragment,
  buildPgWhereFragment,
  buildSqliteWhereFragment,
} from "./build-where.ts";

/** Quote a join alias for the active dialect. */
const quoteJoinAlias = (alias: string, dialect: DatabaseDialect): string =>
  dialect === DatabaseDialect.MySQL ? `\`${alias.replaceAll("`", "``")}\`` : `"${alias}"`;

/**
 * Generate aliases for joins to handle multiple joins on the same table,
 * or when a joined table is the same as the base table.
 * Respects user-provided aliases and only generates them when needed.
 * Returns a map of join index to alias (or undefined if no alias needed)
 *
 * @param joins Array of joined table configurations
 * @param baseTable The name of the base table being queried
 * @param baseSchema The schema of the base table
 * @returns Map from join index to alias name (e.g., "posts_1", "posts_2")
 */
export const generateJoinAliases = (
  joins: JoinedTable[],
  baseTable?: string,
  baseSchema?: string,
): Map<number, string> => {
  const aliases = new Map<number, string>();

  // First pass: collect user-provided aliases
  const userProvidedAliases = new Set<number>();
  const userProvidedTables = new Set<string>();

  for (let i = 0; i < joins.length; i++) {
    const join = joins[i];

    // If user provided an alias, use it
    if (join.alias) {
      aliases.set(i, join.alias);
      userProvidedAliases.add(i);
      userProvidedTables.add(`${join.schema}.${join.table}`);
    }
  }

  // Second pass: count tables that need auto-generation
  // (excluding those where user provided an alias)
  const tableCountMap = new Map<string, number>();
  for (let i = 0; i < joins.length; i++) {
    // Skip if user provided an alias - they're handling it
    if (userProvidedAliases.has(i)) {
      continue;
    }

    const join = joins[i];
    const tableKey = `${join.schema}.${join.table}`;
    tableCountMap.set(tableKey, (tableCountMap.get(tableKey) ?? 0) + 1);
  }

  // Identify tables that appear multiple times (excluding user-provided ones)
  const tablesWithDuplicates = new Set<string>();
  for (const [tableKey, count] of tableCountMap) {
    if (count > 1) {
      tablesWithDuplicates.add(tableKey);
    }
  }

  // Also check if base table appears in non-aliased joins
  if (baseTable && baseSchema) {
    const baseTableKey = `${baseSchema}.${baseTable}`;
    const baseTableCount = tableCountMap.get(baseTableKey) ?? 0;
    if (baseTableCount > 0) {
      tablesWithDuplicates.add(baseTableKey);
    }
  }

  // Third pass: Assign auto-generated aliases
  const tableCounterMap = new Map<string, number>();
  for (let i = 0; i < joins.length; i++) {
    // Skip if user provided an alias
    if (userProvidedAliases.has(i)) {
      continue;
    }

    const join = joins[i];
    const tableKey = `${join.schema}.${join.table}`;

    if (tablesWithDuplicates.has(tableKey)) {
      const counter = (tableCounterMap.get(tableKey) ?? 0) + 1;
      tableCounterMap.set(tableKey, counter);
      aliases.set(i, `${join.table}_${counter}`);
    }
  }

  return aliases;
};

/**
 * Build a WHERE clause fragment for joined table filters (PostgreSQL)
 * Uses aliases when available (from generateJoinAliases)
 */
export const buildPgJoinFilters = (joins: JoinedTable[], aliases?: Map<number, string>): string => {
  const joinFilterClauses: string[] = [];

  for (let i = 0; i < joins.length; i++) {
    const join = joins[i];
    if (!join.filters || join.filters.conditions.length === 0) continue;

    // Use alias if available, otherwise use the actual table name
    const alias = aliases?.get(i);

    // If we have an alias, add it to each condition so buildPgWhereFragment uses it
    // Otherwise, pass schema and table to buildPgWhereFragment
    let conditions = join.filters.conditions;
    if (alias) {
      conditions = conditions.map((c) => ({
        ...c,
        table: alias,
      }));
    }

    const filterClause = buildPgWhereFragment(
      conditions,
      join.filters.logicalOperator,
      alias ? undefined : join.schema,
      alias ? undefined : join.table,
    );
    if (filterClause) {
      joinFilterClauses.push(`(${filterClause})`);
    }
  }

  return joinFilterClauses.length > 0 ? joinFilterClauses.join(" AND ") : "";
};

/**
 * Build a WHERE clause fragment for joined table filters (SQLite)
 * Uses aliases when available (from generateJoinAliases)
 */
export const buildSqliteJoinFilters = (
  joins: JoinedTable[],
  aliases?: Map<number, string>,
): string => {
  const joinFilterClauses: string[] = [];

  for (let i = 0; i < joins.length; i++) {
    const join = joins[i];
    if (!join.filters || join.filters.conditions.length === 0) continue;

    // Use alias if available, otherwise use the actual table name
    const alias = aliases?.get(i);

    // If we have an alias, add it to each condition so buildSqliteWhereFragment uses it
    // Otherwise, pass the table name to buildSqliteWhereFragment
    let conditions = join.filters.conditions;
    if (alias) {
      conditions = conditions.map((c) => ({
        ...c,
        table: alias,
      }));
    }

    const filterClause = buildSqliteWhereFragment(
      conditions,
      join.filters.logicalOperator,
      alias ? undefined : join.table,
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
const getTableRef = (schema: string, table: string, dialect: DatabaseDialect): string => {
  return onDialectOrElse(dialect, {
    postgres: () => (schema ? `${schema}."${table}"` : `"${table}"`),
    mysql: () => (schema ? `\`${schema}\`.\`${table}\`` : `\`${table}\``),
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
  dialect: DatabaseDialect = DatabaseDialect.Postgres,
): string => {
  const q =
    dialect === DatabaseDialect.MySQL
      ? (name: string) => `\`${name.replaceAll("`", "``")}\``
      : (name: string) => `"${name.replaceAll('"', '""')}"`;
  return `${joinTableRef}.${q(referencedColumn)} = ${originalTableRef}.${q(referencingColumn)}`;
};

/**
 * Build filter expression based on dialect
 * If alias is provided, it will be used instead of schema and table
 */
const buildFilterExpression = (
  conditions: any[],
  logicalOperator: LogicalOperatorType,
  schema: string,
  table: string,
  dialect: DatabaseDialect,
  alias?: string,
): string => {
  // If alias is provided, add it to each condition for proper table reference
  if (alias) {
    conditions = conditions.map((c) => ({
      ...c,
      table: alias,
    }));
  }

  return (
    onDialectOrElse(dialect, {
      postgres: () =>
        buildPgWhereFragment(
          conditions,
          logicalOperator,
          alias ? undefined : schema,
          alias ? undefined : table,
        ),
      mysql: () =>
        buildMysqlWhereFragment(
          conditions,
          logicalOperator,
          alias ? undefined : schema,
          alias ? undefined : table,
        ),
      sqlite: () => buildSqliteWhereFragment(conditions, logicalOperator, alias || table),
      libsql: () => buildSqliteWhereFragment(conditions, logicalOperator, alias || table),
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
  dialect: DatabaseDialect,
): string => {
  if (!join.joinCondition.referencingColumn || !join.joinCondition.referencedColumn) {
    throw new SqlError.SqlError({
      cause: `Standard join mode requires referencingColumn and referencedColumn for table ${join.table}`,
    });
  }

  return buildFkCondition(
    joinTableRef,
    join.joinCondition.referencedColumn,
    originalTableRef,
    join.joinCondition.referencingColumn,
    dialect,
  );
};

/**
 * Build ON clause for custom SQL join
 */
const buildCustomJoinCondition = (
  join: JoinedTable,
  joinTableRef: string,
  originalTableRef: string,
  dialect: DatabaseDialect,
): string => {
  const conditions = ((join.joinCondition as CustomJoinCondition).conditions || [])
    .filter((cond) => cond && cond.trim().length > 0)
    .map((cond) => cond.trim());

  if (conditions.length > 0) {
    // Use custom conditions
    return conditions.join(" AND ");
  }

  // Fallback to FK if available
  if (join.joinCondition.referencingColumn && join.joinCondition.referencedColumn) {
    return buildFkCondition(
      joinTableRef,
      join.joinCondition.referencedColumn,
      originalTableRef,
      join.joinCondition.referencingColumn,
      dialect,
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
  alias,
}: {
  join: JoinedTable;
  joinTableRef: string;
  originalTableRef: string;
  dialect: DatabaseDialect;
  alias?: string;
}): string => {
  const joinCondition = join.joinCondition as FilterJoinCondition;
  const hasFilters = joinCondition.filters && joinCondition.filters.conditions.length > 0;
  const hasFkInfo = joinCondition.referencingColumn && joinCondition.referencedColumn;

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
      dialect,
    );
  }

  // Has filters - use alias if available
  const filterExpression = buildFilterExpression(
    joinCondition.filters!.conditions,
    joinCondition.filters!.logicalOperator,
    join.schema,
    join.table,
    dialect,
    alias,
  );

  // Combine with FK if available
  if (hasFkInfo) {
    const fkCondition = buildFkCondition(
      joinTableRef,
      joinCondition.referencedColumn!,
      originalTableRef,
      joinCondition.referencingColumn!,
      dialect,
    );
    return filterExpression ? `${fkCondition} AND ${filterExpression}` : fkCondition;
  }

  // Filters alone
  if (!filterExpression || filterExpression.trim() === "") {
    throw new SqlError.SqlError({
      cause: `Filter-based join has no valid filter expressions for table ${join.table}`,
    });
  }

  return filterExpression;
};

const joinKey = (s: string, t: string) => `${s}.${t}`;

/**
 * Build SQL JOIN clauses from join configuration for a specific dialect
 * Supports three join condition modes: standard (FK-based), custom (SQL expressions), and filters (QueryFilterBuilder)
 * Automatically handles duplicate table joins with aliases.
 *
 * @param joins Array of joined table configurations
 * @param originalSchema Schema of the original table
 * @param originalTable Name of the original table
 * @param dialect SQL dialect - "postgres" or "sqlite"
 * @param joinAliases Optional map from join index to alias name (generated if not provided)
 * @returns Array of JOIN clause SQL strings
 */
export const buildJoinSqlClauses = (
  joins: JoinedTable[],
  originalSchema: string,
  originalTable: string,
  dialect: DatabaseDialect,
  joinAliases?: Map<number, string>,
): string[] => {
  const aliases = joinAliases ?? generateJoinAliases(joins, originalTable, originalSchema);

  const baseKey = `${originalSchema}.${originalTable}`;

  const resolveFromRef = (join: JoinedTable): string => {
    if (!join.joinFrom) {
      return getTableRef(originalSchema, originalTable, dialect);
    }

    const fromKey = joinKey(join.joinFrom.schema, join.joinFrom.table);
    if (fromKey === baseKey) {
      return getTableRef(originalSchema, originalTable, dialect);
    }

    const fromIndex = joins.findIndex(
      (j) => j.schema === join.joinFrom?.schema && j.table === join.joinFrom?.table,
    );
    if (fromIndex === -1) {
      // Unknown anchor: fallback to base table to keep backward compatibility.
      return getTableRef(originalSchema, originalTable, dialect);
    }

    const fromAlias = aliases.get(fromIndex);
    return fromAlias
      ? quoteJoinAlias(fromAlias, dialect)
      : getTableRef(join.joinFrom.schema, join.joinFrom.table, dialect);
  };

  // Ensure joins are emitted in a valid order so a join can reference its anchor.
  // This is a stable, dependency-respecting ordering (only reorders when needed).
  const ordered = (() => {
    const remaining = joins.map((join, index) => ({ join, index }));
    const out: Array<{ join: JoinedTable; index: number }> = [];
    const available = new Set<string>([baseKey]);

    // Iterate until we can't make progress.
    for (let guard = 0; guard < joins.length + 5; guard++) {
      let progressed = false;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const anchor = item.join.joinFrom
          ? joinKey(item.join.joinFrom.schema, item.join.joinFrom.table)
          : baseKey;
        if (available.has(anchor)) {
          remaining.splice(i, 1);
          i--;
          out.push(item);
          available.add(joinKey(item.join.schema, item.join.table));
          progressed = true;
        }
      }

      if (!progressed) {
        break;
      }
      if (remaining.length === 0) {
        break;
      }
    }

    // Cycle or invalid anchor references: preserve remaining order.
    return remaining.length > 0 ? out.concat(remaining) : out;
  })();

  return ordered.map(({ join, index }) => {
    const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";
    const alias = aliases.get(index);
    const baseTableRef = getTableRef(join.schema, join.table, dialect);
    // Use alias in the JOIN clause if available
    const joinTableRef = alias
      ? `${baseTableRef} AS ${quoteJoinAlias(alias, dialect)}`
      : baseTableRef;
    const originalTableRef = resolveFromRef(join);
    const aliasedJoinRef = alias ? quoteJoinAlias(alias, dialect) : baseTableRef;

    let joinCondition: string;
    switch (join.joinCondition.mode) {
      case "standard":
        joinCondition = buildStandardJoinCondition(join, aliasedJoinRef, originalTableRef, dialect);
        break;
      case "custom":
        joinCondition = buildCustomJoinCondition(join, aliasedJoinRef, originalTableRef, dialect);
        break;
      case "filters":
        joinCondition = buildFilterJoinCondition({
          join,
          joinTableRef: aliasedJoinRef,
          originalTableRef,
          dialect,
          alias,
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
  const aliases = generateJoinAliases(joins, table, schema);
  const tableRef = onDialectOrElse(dialect, {
    postgres: () => `${schema}."${table}"`,
    mysql: () => (schema ? `\`${schema}\`.\`${table}\`` : `\`${table}\``),
    sqlite: () => `"${table}"`,
    libsql: () => `"${table}"`,
    orElse: () => {
      throw new SqlError.SqlError({ cause: "Unsupported dialect" });
    },
  });

  // Build select clause with all columns from all tables
  const selectParts = [`SELECT ${tableRef}.*`];

  for (let i = 0; i < joins.length; i++) {
    const join = joins[i];
    const alias = aliases.get(i);
    const joinTableRef = onDialectOrElse(dialect, {
      postgres: () => {
        const baseRef = `${join.schema}."${join.table}"`;
        return alias ? `${baseRef} AS "${alias}"` : baseRef;
      },
      mysql: () => {
        const baseRef = join.schema ? `\`${join.schema}\`.\`${join.table}\`` : `\`${join.table}\``;
        return alias ? `${baseRef} AS \`${alias}\`` : baseRef;
      },
      sqlite: () => {
        const baseRef = `"${join.table}"`;
        return alias ? `${baseRef} AS "${alias}"` : baseRef;
      },
      libsql: () => {
        const baseRef = `"${join.table}"`;
        return alias ? `${baseRef} AS "${alias}"` : baseRef;
      },
      orElse: () => {
        throw new SqlError.SqlError({ cause: "Unsupported dialect" });
      },
    });

    // For select preview, use the actual table/alias reference
    const selectRef = alias ? `"${alias}"` : joinTableRef;
    selectParts.push(`${selectRef}.*`);
  }

  const selectClause = selectParts.join(", ");

  // Build FROM clause
  const fromClause = `FROM ${tableRef}`;

  // Build JOIN clauses
  const joinClauses = buildJoinSqlClauses(joins, schema, table, dialect, aliases);
  const joinClausesText = joinClauses.length > 0 ? `\n${joinClauses.join("\n")}` : "";

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
    joinTableRef: (schema: string, table: string, alias?: string) => string;
    joinTableKey: (schema: string, table: string, alias?: string) => string;
    quoteIdent: (name: string) => string;
  },
  joinAliases?: Map<number, string>,
): string => {
  const aliases = joinAliases ?? generateJoinAliases(joins);
  const columns: string[] = [];
  const baseTableRef = formatters.baseTableRef(schema, table);
  const baseTableKey = formatters.baseTableKey(schema, table);
  const q = formatters.quoteIdent;

  // Add original table columns with dot-delimited aliases
  const baseTableColumns = tableColumnsMap.get(baseTableKey) || [];
  if (baseTableColumns.length > 0) {
    const baseCols = baseTableColumns
      .map((col) => `${baseTableRef}.${q(col.name)} as ${q(`${table}.${col.name}`)}`)
      .join(", ");
    columns.push(baseCols);
  } else {
    // Fallback to * if columns not available
    columns.push(`${baseTableRef}.*`);
  }

  // Add joined table columns
  for (let i = 0; i < joins.length; i++) {
    const join = joins[i];
    const alias = aliases.get(i);
    const joinTableRef = formatters.joinTableRef(join.schema, join.table, alias);
    const joinTableKey = formatters.joinTableKey(join.schema, join.table, alias);
    const joinedTableColumns = tableColumnsMap.get(joinTableKey) || [];

    // For column aliasing, use the alias if present, otherwise use the table name
    const columnAlias = alias || join.table;

    if (join.columns === "all") {
      if (joinedTableColumns.length > 0) {
        const joinedCols = joinedTableColumns
          .map((col) => `${joinTableRef}.${q(col.name)} as ${q(`${columnAlias}.${col.name}`)}`)
          .join(", ");
        columns.push(joinedCols);
      } else {
        // Fallback to * if columns not available
        columns.push(`${joinTableRef}.*`);
      }
    } else {
      const selectedCols = join.columns
        .map((col) => `${joinTableRef}.${q(col)} as ${q(`${columnAlias}.${col}`)}`)
        .join(", ");
      columns.push(selectedCols);
    }
  }

  return columns.join(", ");
};

/**
 * Build SELECT clause with joined table columns for PostgreSQL
 * Explicitly selects and aliases all columns with table prefix (e.g., "table.column")
 * Handles duplicate table joins with aliases (e.g., "table_1.column", "table_2.column")
 */
export const buildPgSelectWithJoins = (
  schema: string,
  table: string,
  joins: JoinTablesConfig["joins"],
  tableColumnsMap: Map<string, { name: string }[]>,
  joinAliases?: Map<number, string>,
): string => {
  return buildSelectWithJoinsGeneric(
    schema,
    table,
    joins,
    tableColumnsMap,
    {
      baseTableRef: (s, t) => (s ? `${s}."${t}"` : `"${t}"`),
      baseTableKey: (s, t) => (s ? `${s}.${t}` : t),
      joinTableRef: (s, t, alias) => {
        const baseRef = s ? `${s}."${t}"` : `"${t}"`;
        return alias ? `"${alias}"` : baseRef;
      },
      joinTableKey: (s, t, alias) => {
        if (alias) return alias;
        return s ? `${s}.${t}` : t;
      },
      quoteIdent: (name) => `"${name.replaceAll('"', '""')}"`,
    },
    joinAliases,
  );
};

/**
 * Build SELECT clause with joined table columns for MySQL (backtick quoting).
 */
export const buildMysqlSelectWithJoins = (
  schema: string,
  table: string,
  joins: JoinTablesConfig["joins"],
  tableColumnsMap: Map<string, { name: string }[]>,
  joinAliases?: Map<number, string>,
): string => {
  return buildSelectWithJoinsGeneric(
    schema,
    table,
    joins,
    tableColumnsMap,
    {
      baseTableRef: (s, t) => (s ? `\`${s}\`.\`${t}\`` : `\`${t}\``),
      baseTableKey: (s, t) => (s ? `${s}.${t}` : t),
      joinTableRef: (s, t, alias) => {
        if (alias) return `\`${alias}\``;
        return s ? `\`${s}\`.\`${t}\`` : `\`${t}\``;
      },
      joinTableKey: (s, t, alias) => {
        if (alias) return alias;
        return s ? `${s}.${t}` : t;
      },
      quoteIdent: (name) => `\`${name.replaceAll("`", "``")}\``,
    },
    joinAliases,
  );
};

/**
 * Build SELECT clause with joined table columns for SQLite
 * Explicitly selects and aliases all columns with table prefix (e.g., "table.column")
 * Handles duplicate table joins with aliases (e.g., "table_1.column", "table_2.column")
 */
export const buildSqliteSelectWithJoins = (
  table: string,
  joins: JoinTablesConfig["joins"],
  tableColumnsMap: Map<string, { name: string }[]>,
  joinAliases?: Map<number, string>,
): string => {
  return buildSelectWithJoinsGeneric(
    "", // schema not used in SQLite
    table,
    joins,
    tableColumnsMap,
    {
      baseTableRef: (_s, t) => `"${t}"`,
      baseTableKey: (_s, t) => t,
      joinTableRef: (_s, t, alias) => (alias ? `"${alias}"` : `"${t}"`),
      joinTableKey: (_s, t, alias) => (alias ? alias : t),
      quoteIdent: (name) => `"${name.replaceAll('"', '""')}"`,
    },
    joinAliases,
  );
};
