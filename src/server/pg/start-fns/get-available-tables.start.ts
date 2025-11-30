import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableTableList } from "../fns/get-available-tables.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const getAvailableTablesServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			getAvailableTableList.pipe(
				Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url)),
			),
		);
	});

export const listAvailableTablesQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableTablesServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableList", input],
		queryFn: () => getAvailableTablesServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
