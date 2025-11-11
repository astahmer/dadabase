import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableSchemas } from "../fns/get-available-schemas.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const getAvailableSchemasServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			getAvailableSchemas.pipe(
				Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url)),
			),
		);
	});

export const listAvailableSchemasQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableSchemasServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "schemaList", input],
		queryFn: () => getAvailableSchemasServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
