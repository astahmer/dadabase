import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import {
	getTableColumns,
	type ColumnMetadata,
} from "../fns/get-table-columns.kysely.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

const getTableColumnsServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<ColumnMetadata[]> => {
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(ctx.data.url);

				if (!connection) {
					throw new Error(`Connection not found for URL: ${ctx.data.url}`);
				}

				return yield* getTableColumns({
					schema: ctx.data.schema,
					table: ctx.data.table,
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
			}),
		);
	});

export const getTableColumnsQueryOptions = (
	input: InferServerFnSchema<typeof getTableColumnsServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "tableColumns", input],
		queryFn: () => getTableColumnsServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
