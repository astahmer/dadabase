import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getAvailableDatabaseList } from "../fns/get-available-database-list.kysely.ts";

export const getAvailableDatabaseListServerFn = createServerFn()
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
