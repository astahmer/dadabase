import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableDatabaseList } from "../fns/get-available-database-list.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

const getAvailableDatabaseListServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(ctx.data.url);

				if (!connection) {
					throw new Error(`Connection not found for URL: ${ctx.data.url}`);
				}

				return yield* getAvailableDatabaseList({
					connectionId: connection.id,
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(ctx.data.url)));
			}),
		);
	});

export const listAvailableDatabase = (
	input: InferServerFnSchema<typeof getAvailableDatabaseListServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "dbList", input],
		queryFn: () => getAvailableDatabaseListServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
