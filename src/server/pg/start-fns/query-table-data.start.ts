import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { queryTableData } from "../fns/query-table-data.kysely.ts";

const queryTableDataServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
			limit: Schema.optional(Schema.Number),
			offset: Schema.optional(Schema.Number),
			orderBy: Schema.optional(Schema.String),
			orderDirection: Schema.optional(Schema.Literal("asc", "desc")),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		async (
			ctx,
		): Promise<{
			rows: Record<string, any>[];
			rowCount: number;
			timeTaken: number;
			ranAt: number;
		}> => {
			const startTime = Date.now();
			const { rows, rowCount } = (await Effect.runPromise(
				queryTableData({
					schema: ctx.data.schema,
					table: ctx.data.table,
					limit: ctx.data.limit ?? 50,
					offset: ctx.data.offset ?? 0,
					orderBy: ctx.data.orderBy,
					orderDirection: ctx.data.orderDirection,
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url))),
			)) as { rows: Record<string, any>[]; rowCount: number };
			const endTime = Date.now();

			return {
				rows,
				rowCount,
				timeTaken: endTime - startTime,
				ranAt: startTime,
			};
		},
	);

export const queryTableDataQueryOptions = (
	input: InferServerFnSchema<typeof queryTableDataServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "tableData", input],
		queryFn: () => queryTableDataServerFn({ data: input }),
	});
