import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";
import { RemoteConnectionId } from "#src/server/db-connection/remote-connection.tag.ts";
import { getTableRelationships } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";

const getTableRelationshipsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<TableRelationship[]> => {
		const program = Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(ctx.data.url);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${ctx.data.url}`),
				);
			}

			return yield* getTableRelationships({
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

export const getTableRelationshipsQueryOptions = (
	input: InferServerFnSchema<typeof getTableRelationshipsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableRelationships", input],
		queryFn: () => getTableRelationshipsServerFn({ data: input }),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
