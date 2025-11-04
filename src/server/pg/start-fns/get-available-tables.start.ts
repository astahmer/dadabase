import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableTableList } from "../fns/get-available-tables.kysely.ts";

const getAvailableTablesServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await Effect.runPromise(
			getAvailableTableList.pipe(
				Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url)),
			),
		);
	});

export const listAvailableTablesQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableTablesServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "tableList", input],
		queryFn: () => getAvailableTablesServerFn({ data: input }),
	});
