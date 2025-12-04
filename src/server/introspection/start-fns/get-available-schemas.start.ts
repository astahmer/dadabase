import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { getAvailableSchemas } from "#src/server/introspection/introspection.ts";

const getAvailableSchemasServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		const program = Effect.gen(function* () {
			const sqlLayer = yield* makeKyselyPgDatabaseLayer(ctx.data.url);
			return yield* getAvailableSchemas().pipe(Effect.provide(sqlLayer));
		});
		return await AppRuntime.runPromise(program);
	});

export const listAvailableSchemasQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableSchemasServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "schemaList", input],
		queryFn: () => getAvailableSchemasServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
