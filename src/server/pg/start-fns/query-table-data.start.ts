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
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<Record<string, any>[]> => {
		return (await Effect.runPromise(
			queryTableData({
				schema: ctx.data.schema,
				table: ctx.data.table,
				limit: ctx.data.limit ?? 50,
			}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url))),
		)) as Record<string, any>[];
	});

export const queryTableDataQueryOptions = (
	input: InferServerFnSchema<typeof queryTableDataServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "tableData", input],
		queryFn: () => queryTableDataServerFn({ data: input }),
	});
