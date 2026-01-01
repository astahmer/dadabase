import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import type {
	JoinedTable,
	JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import {
	filterQueryValidConditions,
	QueryFilter,
	type QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { queryTableRows } from "#src/server/introspection/introspection.ts";

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
	type: Schema.Literal("left", "inner", "right", "full", "cross"),
	columns: Schema.Union(
		Schema.Literal("all"),
		Schema.Array(Schema.String).pipe(Schema.mutable),
	).pipe(Schema.mutable),
	joinCondition: JoinConditionSchema,
	filters: QueryFilter.pipe(Schema.optional),
}).pipe(Schema.mutable);

type JoinedTableType = typeof JoinedTableSchema.Type;
const _lint = {} as JoinedTableType satisfies JoinedTable;
_lint;

export const QueryTableRowsInputSchema = Schema.Struct({
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
});
const queryTableDataServerFn = createServerFn({ method: "POST" })
	.inputValidator(QueryTableRowsInputSchema.pipe(Schema.standardSchemaV1))
	.handler(
		createRemoteIntrospectionHandler((input) =>
			Effect.gen(function* () {
				const startTime = Date.now();

				// Filter out conditions with null/undefined values (apply validation on server side too)
				const validatedFilters = input.filters
					? filterQueryValidConditions(input.filters)
					: null;

				const output = yield* queryTableRows({
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

				const endTime = Date.now();
				return {
					rows: output.rows.map((row) =>
						Object.entries(row as any).reduce((acc, [key, value]) => {
							if (output.columnList.includes(key)) acc.push(value);
							return acc;
						}, [] as any[]),
					) as any[],
					rowCount: output.rowCount,
					columns: output.columnList,
					timeTaken: endTime - startTime,
					ranAt: startTime,
					rowsAffected: output.rowsAffected,
				};
			}),
		),
	);

export type QueryTableDataInput = {
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
};

export const queryTableDataQueryOptions = (input: QueryTableDataInput) => {
	// console.log("[rows query]", input)
	return queryOptions({
		queryKey: ["remote", "rows", input],
		queryFn: async () => queryTableDataServerFn({ data: input }),
		meta: { loggable: true },
		placeholderData: keepPreviousData,
		select: (data) => ({
			...data,
			rows: data.rows.map((row) => {
				const record: Record<string, unknown> = {};
				data.columns.forEach((col, colIndex) => {
					record[col] = row[colIndex];
				});
				return record;
			}),
		}),
	});
};
