import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { getAvailableTables } from "#src/server/introspection/introspection.ts";

const getAvailableTablesServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		const program = Effect.gen(function* () {
			const sqlLayer = yield* makeKyselyPgDatabaseLayer(ctx.data.url);
			// TODO
			return yield* getAvailableTables({ schema: "public" }).pipe(
				Effect.provide(sqlLayer),
			);
		});
		return await AppRuntime.runPromise(program);
	});

export const listAvailableTablesQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableTablesServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableList", input],
		queryFn: () => getAvailableTablesServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
