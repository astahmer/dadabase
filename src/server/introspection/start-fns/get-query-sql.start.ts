import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";

import {
  filterQueryValidConditions,
  type QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";

import { buildQuerySql } from "../sql-query-builder/build-query-sql.ts";
import { formatSqlForDisplay } from "../sql-query-builder/format-sql.ts";

export type QuerySqlInput = {
  dialect: DatabaseDialect;
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
};

/**
 * Query options for building the SQL query string on the client
 * This is a pure function with no I/O, so it executes instantly
 * without making a server round-trip
 */
export const getQueryAsSql = (input: QuerySqlInput) => {
  const validatedFilters = input.filters ? filterQueryValidConditions(input.filters) : null;
  const validatedHaving = input.having ? filterQueryValidConditions(input.having) : null;

  const dialect = input.dialect;

  // Generate the SQL string (this is a pure function, no database access)
  const { sql } = buildQuerySql(
    {
      schema: input.schema,
      table: input.table,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      orderBy: input.orderBy,
      orderDirection: input.orderDirection,
      nullsOrder: input.nullsOrder,
      filters: validatedFilters ?? {
        conditions: [],
        logicalOperator: "and",
      },
      groupBy: input.groupBy,
      having: validatedHaving ?? undefined,
      joins: Array.from(input.joins ?? []),
      selectedColumns: input.selectedColumns ? Array.from(input.selectedColumns) : undefined,
      excludedColumns: input.excludedColumns ? Array.from(input.excludedColumns) : undefined,
    },
    dialect,
  );

  return {
    sql: formatSqlForDisplay(sql),
  };
};
