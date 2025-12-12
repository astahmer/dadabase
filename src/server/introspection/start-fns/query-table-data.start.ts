import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import {
	filterQueryValidConditions,
	QueryFilter,
	type QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { queryTableRows } from "#src/server/introspection/introspection.ts";
import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";

const JoinSchema = Schema.Struct({
	table: Schema.String,
	schema: Schema.String,
	type: Schema.Literal("left", "inner"),
	columns: Schema.Union(
		Schema.Literal("all"),
		Schema.Array(Schema.String),
	).pipe(Schema.mutable),
	referencingColumn: Schema.String,
	referencedColumn: Schema.String,
});

const InputSchema = Schema.Struct({
	url: Schema.String,
	dbName: Schema.String.pipe(Schema.optional),
	schema: Schema.String.pipe(Schema.optionalWith({ default: () => "public" })),
	table: Schema.String,
	orderBy: Schema.String.pipe(Schema.optional),
	orderDirection: Schema.Literal("asc", "desc").pipe(
		Schema.optionalWith({ default: () => "asc" }),
	),
	limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 50 })),
	offset: Schema.Number.pipe(Schema.optionalWith({ default: () => 0 })),
	filters: QueryFilter.pipe(Schema.optional),
	joins: Schema.Array(JoinSchema).pipe(Schema.optional),
});
const queryTableDataServerFn = createServerFn({ method: "POST" })
	.inputValidator(InputSchema.pipe(Schema.standardSchemaV1))
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
					filters: validatedFilters ?? {
						conditions: [],
						logicalOperator: "and",
					},
					joins: Array.from(input.joins ?? []),
				});

				const endTime = Date.now();
				return {
					rows: output.rows as any[],
					rowCount: output.rowCount,
					timeTaken: endTime - startTime,
					ranAt: startTime,
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
	filters?: QueryFilterType;
	joins?: JoinTablesConfig["joins"];
};

export const queryTableDataQueryOptions = (input: QueryTableDataInput) => {
	// console.log("[rows query]", input)
	return queryOptions({
		queryKey: ["remote", "rows", input],
		queryFn: async () => queryTableDataServerFn({ data: input }),
		meta: { loggable: true },
	});
};
