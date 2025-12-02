import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";
import { RemoteConnectionId } from "#src/server/db-connection/remote-connection.tag.ts";
import {
	getTableColumns,
	type TableColumnMetadata,
} from "#src/server/introspection/introspection.ts";

const getTableColumnsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<TableColumnMetadata[]> => {
		const program = Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(ctx.data.url);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${ctx.data.url}`),
				);
			}

			return yield* getTableColumns({
				schema: ctx.data.schema,
				table: ctx.data.table,
			}).pipe(
				withRemoteConnectionLayers(
					connection.url,
					RemoteConnectionId.make(connection.id),
				),
			);
		});

		return await AppRuntime.runPromise(program);
	});

export const getTableColumnsQueryOptions = (
	input: InferServerFnSchema<typeof getTableColumnsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableColumns", input],
		queryFn: () => getTableColumnsServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
