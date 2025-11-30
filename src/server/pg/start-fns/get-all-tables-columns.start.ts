import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import {
	getAllTablesColumns,
	type TableColumnsMetadata,
} from "../fns/get-all-tables-columns.kysely.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";

const getAllTablesColumnsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<TableColumnsMetadata[]> => {
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(ctx.data.url);

				if (!connection) {
					return yield* Effect.fail(
						new Error(`Connection not found for URL: ${ctx.data.url}`),
					);
				}

				return yield* getAllTablesColumns({
					schema: ctx.data.schema,
					connectionId: connection.id,
				}).pipe(withRemoteConnectionLayers(connection.url, connection.id));
			}),
		);
	});

export const getAllTablesColumnsQueryOptions = (
	input: InferServerFnSchema<typeof getAllTablesColumnsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "allTablesColumns", input],
		queryFn: () => getAllTablesColumnsServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
