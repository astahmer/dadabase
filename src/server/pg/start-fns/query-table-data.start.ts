import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { queryTableData } from "../fns/query-table-data.kysely.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { QueryFilter, type QueryFilterType } from "#src/lib/query-filter";

// Using Record type with any for now to avoid schema validation issues

const InputSchema = Schema.Struct({
	url: Schema.URL,
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
});
const queryTableDataServerFn = createServerFn()
	.inputValidator(InputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		console.time("queryTableDataServerFn");
		const input = ctx.data;

		const startTime = Date.now();
		const { rows, rowCount } = (await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(input.url.toString());

				if (!connection) {
					throw new Error(`Connection not found for URL: ${input.url}`);
				}

				return yield* queryTableData({
					schema: input.schema,
					table: input.table,
					limit: input.limit ?? 50,
					offset: input.offset ?? 0,
					orderBy: input.orderBy,
					orderDirection: input.orderDirection,
					filters: input.filters ?? { conditions: [], logicalOperator: "and" },
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
			}),
		)) as { rows: Record<string, any>[]; rowCount: number };
		const endTime = Date.now();
		console.timeEnd("queryTableDataServerFn");

		return {
			rows,
			rowCount,
			timeTaken: endTime - startTime,
			ranAt: startTime,
		};
	});

export type QueryTableDataInput = {
	url: string;
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: QueryFilterType;
};

export const queryTableDataQueryOptions = (input: QueryTableDataInput) => {
	// console.log("[rows query]", input)
	return queryOptions({
		queryKey: [
			"pg",
			"tableData",
			input.url,
			input.schema,
			input.table,
			input.limit ?? 50,
			input.offset ?? 0,
			input.orderBy,
			input.orderDirection,
			JSON.stringify(
				input.filters ?? { conditions: [], logicalOperator: "and" },
			),
		],
		queryFn: async () => queryTableDataServerFn({ data: input as any }),
	});
};
