import type {
    JoinTablesConfig
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import {
    filterQueryValidConditions,
    QueryFilter,
    type QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildQuerySql } from "#src/lib/sql-query-builder/build-query-sql.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { queryTableRows } from "#src/server/introspection/introspection.ts";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

const StandardJoinConditionSchema = Schema.Struct({
    mode: Schema.Literal("standard"),
    referencingColumn: Schema.String,
    referencedColumn: Schema.String,
}).pipe(Schema.mutable);

const CustomJoinConditionSchema = Schema.Struct({
    mode: Schema.Literal("custom"),
    referencingColumn: Schema.String.pipe(Schema.optional),
    referencedColumn: Schema.String.pipe(Schema.optional),
    conditions: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const FilterJoinConditionSchema = Schema.Struct({
    mode: Schema.Literal("filters"),
    referencingColumn: Schema.String.pipe(Schema.optional),
    referencedColumn: Schema.String.pipe(Schema.optional),
    filters: QueryFilter.pipe(Schema.optional),
}).pipe(Schema.mutable);

const JoinConditionSchema = Schema.Union(
    StandardJoinConditionSchema,
    CustomJoinConditionSchema,
    FilterJoinConditionSchema,
);

export const JoinedTableSchema = Schema.Struct({
    table: Schema.String,
    schema: Schema.String,
    joinFrom: Schema.Struct({
        schema: Schema.String,
        table: Schema.String,
    }).pipe(Schema.optional),
    alias: Schema.String.pipe(Schema.optional),
    type: Schema.Literal("left", "inner"),
    columns: Schema.Union(
        Schema.Literal("all"),
        Schema.Array(Schema.String).pipe(Schema.mutable),
    ).pipe(Schema.mutable),
    joinCondition: JoinConditionSchema,
    filters: QueryFilter.pipe(Schema.optional),
}).pipe(Schema.mutable);

const InputSchema = Schema.Struct({
    url: Schema.String,
    dbName: Schema.String.pipe(Schema.optional),
    schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
    table: Schema.String,
    orderBy: Schema.String.pipe(Schema.optional),
    orderDirection: Schema.Literal("asc", "desc").pipe(
        Schema.optionalWith({ default: () => "asc" }),
    ),
    nullsOrder: Schema.Literal("first", "last").pipe(Schema.optional),
    limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
    offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
    filters: QueryFilter.pipe(Schema.optional),
    joins: Schema.Array(JoinedTableSchema).pipe(Schema.optional),
    selectedColumns: Schema.Array(Schema.String).pipe(
        Schema.mutable,
        Schema.optional,
    ),
    excludedColumns: Schema.Array(Schema.String).pipe(
        Schema.mutable,
        Schema.optional,
    ),
    /** Whether to include query results along with the SQL */
    includeResults: Schema.Boolean.pipe(
        Schema.optionalWith({ default: () => false }),
    ),
});

/**
 * Server function that generates the SQL query string for a table
 * Can optionally execute the query and return results alongside the SQL
 *
 * This allows frontend to:
 * 1. Preview the SQL query before execution (no latency)
 * 2. Display the raw SQL for debugging/understanding
 * 3. Copy SQL to clipboard or export
 * 4. In future: load into Monaco editor for manual SQL editing
 */
export const getQuerySqlServerFn = createServerFn({ method: "POST" })
    .inputValidator(InputSchema.pipe(Schema.standardSchemaV1))
    .handler(
        createRemoteIntrospectionHandler((input) =>
            Effect.gen(function* () {
                const validatedFilters = input.filters
                    ? filterQueryValidConditions(input.filters)
                    : null;

                // Determine which dialect we're using based on connection URL or dbName
                // Default to postgres, can be overridden based on dbName
                const dialect = input.dbName?.toLowerCase().includes("sqlite")
                    ? DatabaseDialect.SQLite
                    : DatabaseDialect.Postgres;

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

                // If user wants results too, execute the query
                let results: any = null;
                if (input.includeResults) {
                    results = yield* queryTableRows({
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
                    });
                }

                return {
                    sql,
                    formattedSql,
                    results: results
                        ? {
                            rows: results.rows.map((row: any) =>
                                Object.entries(row as any).reduce((acc, [key, value]) => {
                                    if (results.columnList.includes(key)) acc.push(value);
                                    return acc;
                                }, [] as any[]),
                            ) as any[],
                            rowCount: results.rowCount,
                            columns: results.columnList,
                            hasNextPage: results.hasNextPage,
                        }
                        : null,
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
        placeholderData: keepPreviousData,
    });
};
