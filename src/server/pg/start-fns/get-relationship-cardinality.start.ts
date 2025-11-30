import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import {
	getRelationshipCardinality,
	type CardinalityResult,
} from "../fns/get-relationship-cardinality.kysely.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";

const getRelationshipCardinalityServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
			columns: Schema.Array(Schema.String),
			isIncomingRelationship: Schema.optional(Schema.Boolean),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<CardinalityResult> => {
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(ctx.data.url);

				if (!connection) {
					return yield* Effect.fail(
						new Error(`Connection not found for URL: ${ctx.data.url}`),
					);
				}

				return yield* getRelationshipCardinality({
					schema: ctx.data.schema,
					table: ctx.data.table,
					columns: Array.from(ctx.data.columns),
					connectionId: connection.id,
					isIncomingRelationship: ctx.data.isIncomingRelationship,
				}).pipe(withRemoteConnectionLayers(connection.url, connection.id));
			}),
		);
	});

export const getRelationshipCardinalityQueryOptions = (
	input: InferServerFnSchema<typeof getRelationshipCardinalityServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "relationshipCardinality", input],
		queryFn: () => getRelationshipCardinalityServerFn({ data: input }),
		staleTime: 30 * 60 * 1000, // 30 minutes (schema changes infrequently)
	});
