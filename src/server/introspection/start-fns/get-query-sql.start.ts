import type {
    JoinTablesConfig
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import {
    filterQueryValidConditions,
    type QueryFilterType
} from "#src/components/query-builder/query-filter.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { buildQuerySql } from "#src/server/introspection/sql-query-builder/build-query-sql.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { QueryTableRowsInputSchema } from "./query-table-data.start.ts";

/**
 * Server function that generates the SQL query string for a table
 *
 * This allows frontend to:
 * 1. Preview the SQL query before execution (no latency)
 * 2. Display the raw SQL for debugging/understanding
 * 3. Copy SQL to clipboard or export
 * 4. In future: load into Monaco editor for manual SQL editing
 */
export const getQuerySqlServerFn = createServerFn({ method: "POST" })
    .inputValidator(QueryTableRowsInputSchema.pipe(Schema.standardSchemaV1))
    .handler(
        createRemoteIntrospectionHandler((input, connection) =>
            Effect.gen(function* () {
                const validatedFilters = input.filters
                    ? filterQueryValidConditions(input.filters)
                    : null;

                const dialect = connection.dialect

                // Generate the SQL query (this is a pure function, no database access)
                const { sql, formattedSql } = buildQuerySql(
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
                        joins: Array.from(input.joins ?? []),
                        selectedColumns: input.selectedColumns
                            ? Array.from(input.selectedColumns)
                            : undefined,
                        excludedColumns: input.excludedColumns
                            ? Array.from(input.excludedColumns)
                            : undefined,
                    },
                    dialect,
                );

                return {
                    sql,
                    formattedSql,
                };
            }),
        ),
    );

export type QuerySqlInput = {
    url: string;
    schema: string;
    table: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    nullsOrder?: "first" | "last";
    filters?: QueryFilterType;
    joins?: JoinTablesConfig["joins"];
    selectedColumns?: string[];
    excludedColumns?: string[];
    /** Whether to include query results along with the SQL */
    includeResults?: boolean;
};

/**
 * Query options for fetching the SQL query string
 * Uses React Query to cache the result
 */
export const querySqlQueryOptions = (input: QuerySqlInput) => {
    return queryOptions({
        queryKey: ["remote", "query-sql", input],
        queryFn: async () => getQuerySqlServerFn({ data: input }),
        meta: { loggable: true },
    });
};
