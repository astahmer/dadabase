import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableDatabaseList } from "../../fns/pg/get-available-database-list.kysely.ts";

const getAvailableDatabaseListServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await Effect.runPromise(
			getAvailableDatabaseList.pipe(
				Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url)),
			),
		);
	});

export const listAvailableDatabase = (
	input: InferServerFnSchema<typeof getAvailableDatabaseListServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "dbList", input],
		queryFn: () => getAvailableDatabaseListServerFn({ data: input }),
	});
