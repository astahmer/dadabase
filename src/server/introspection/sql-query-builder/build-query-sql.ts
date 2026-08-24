import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

import { DatabaseDialect } from "#src/db/dialect.ts";
import {
  buildMysqlWhereFragment,
  buildPgWhereFragment,
  buildSqliteWhereFragment,
} from "#src/server/introspection/build-where.ts";
import { escapeIdentifier, escapeMysqlIdentifier } from "#src/server/introspection/escape-value.ts";
import {
  buildJoinSqlClauses,
  buildPgJoinFilters,
  buildSqliteJoinFilters,
  generateJoinAliases,
} from "#src/server/introspection/join-builder.ts";

import {
  buildGroupByClause,
  buildHavingClause,
  formatGroupByExpression,
} from "./build-group-by-clause.ts";
import { buildLimitClause, buildOrderByClause } from "./build-pagination-clause.ts";

/**
 * Build complete SQL SELECT query for table data
 * Shared between frontend preview and backend execution
 */
export interface BuildQuerySqlInput {
  schema: string;
  table: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  nullsOrder?: "first" | "last";
  filters?: QueryFilterType;
  groupBy?: string[];
  having?: QueryFilterType;
  joins?: JoinTablesConfig["joins"];
  selectedColumns?: string[];
  excludedColumns?: string[];
}

export interface QuerySqlResult {
  sql: string;
}

/**
 * Build WHERE clause with both main table filters and join filters
 * Used by both preview and execution paths
 */
export const buildWhereClauseWithJoins = (
  dialect: DatabaseDialect,
  filters: QueryFilterType | undefined,
  joins: JoinTablesConfig["joins"] | undefined,
  joinAliases: Map<number, string>,
): string => {
  const mainFilter =
    filters && filters.conditions.length > 0
      ? dialect === DatabaseDialect.Postgres ||
        dialect === DatabaseDialect.DuckDB ||
        dialect === DatabaseDialect.Csv
        ? buildPgWhereFragment(filters.conditions, filters.logicalOperator ?? "and")
        : dialect === DatabaseDialect.MySQL
          ? buildMysqlWhereFragment(filters.conditions, filters.logicalOperator ?? "and")
          : buildSqliteWhereFragment(filters.conditions, filters.logicalOperator ?? "and")
      : "";

  const joinFilter =
    joins && joins.length > 0
      ? dialect === DatabaseDialect.Postgres ||
        dialect === DatabaseDialect.MySQL ||
        dialect === DatabaseDialect.DuckDB ||
        dialect === DatabaseDialect.Csv
        ? buildPgJoinFilters(joins, joinAliases)
        : buildSqliteJoinFilters(joins, joinAliases)
      : "";

  const parts = [mainFilter, joinFilter].filter(Boolean);
  return parts.length > 0 ? parts.join(" AND ") : "";
};

/**
 * Build a SELECT query SQL string (without executing)
 * Used by both queryTableRows (execution) and preview endpoint
 *
 * @param input Query parameters
 * @param dialect Database dialect
 * @param customSelectClause Optional custom SELECT clause (e.g., with column aliases for joins)
 * @returns SQL string and formatted SQL
 */
export const buildQuerySql = (
  input: BuildQuerySqlInput,
  dialect: DatabaseDialect,
  customSelectClause?: string,
): QuerySqlResult => {
  const {
    schema = "public",
    table,
    limit = 50,
    offset = 0,
    orderBy,
    orderDirection = "asc",
    nullsOrder,
    filters,
    groupBy,
    having,
    joins = [],
    selectedColumns = [],
  } = input;

  // Build JOIN clauses and aliases
  const joinAliases = joins.length > 0 ? generateJoinAliases(joins, table, schema) : new Map();
  const joinClauses =
    joins.length > 0 ? buildJoinSqlClauses(joins, schema, table, dialect, joinAliases) : [];

  // Build WHERE clause (including both main table and join filters)
  const whereClause = buildWhereClauseWithJoins(
    dialect,
    filters,
    joins.length > 0 ? joins : undefined,
    joinAliases,
  );

  const groupByClause = buildGroupByClause(groupBy);
  const havingClause = buildHavingClause(having);
  const orderClause = buildOrderByClause(orderBy, orderDirection, nullsOrder);
  const limitClause = buildLimitClause(limit, offset);

  // Build SELECT clause — with GROUP BY and no explicit columns, select the group keys
  // (SELECT * GROUP BY is invalid in PostgreSQL)
  let selectClause = customSelectClause || "*";
  if (!customSelectClause && selectedColumns && selectedColumns.length > 0) {
    selectClause = selectedColumns.join(", ");
  } else if (!customSelectClause && groupBy && groupBy.length > 0) {
    selectClause = groupBy.map(formatGroupByExpression).filter(Boolean).join(", ");
  }

  // Build the query
  const fromClause =
    dialect === DatabaseDialect.Postgres || dialect === DatabaseDialect.DuckDB
      ? schema
        ? `FROM ${escapeIdentifier(schema)}.${escapeIdentifier(table)}`
        : `FROM ${escapeIdentifier(table)}`
      : dialect === DatabaseDialect.MySQL
        ? schema
          ? `FROM ${escapeMysqlIdentifier(schema)}.${escapeMysqlIdentifier(table)}`
          : `FROM ${escapeMysqlIdentifier(table)}`
        : `FROM ${escapeIdentifier(table)}`;

  const sqlParts = [
    `SELECT ${selectClause}`,
    fromClause,
    ...joinClauses,
    whereClause && `WHERE ${whereClause}`,
    groupByClause,
    havingClause,
    orderClause,
    limitClause,
  ].filter(Boolean);

  const sql = sqlParts.join(" ");

  return { sql };
};
