import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";
import { RemoteConnectionId } from "#src/server/db-connection/remote-connection.tag.ts";
import { getAvailableDatabases } from "#src/server/introspection/introspection.ts";

const getAvailableDatabaseListServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		const program = Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(ctx.data.url);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${ctx.data.url}`),
				);
			}

			return yield* getAvailableDatabases().pipe(
				withRemoteConnectionLayers(
					ctx.data.url,
					RemoteConnectionId.make(connection.id),
				),
			);
		});
		return await AppRuntime.runPromise(program);
	});

export const listAvailableDatabase = (
	input: InferServerFnSchema<typeof getAvailableDatabaseListServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "dbList", input],
		queryFn: () => getAvailableDatabaseListServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
