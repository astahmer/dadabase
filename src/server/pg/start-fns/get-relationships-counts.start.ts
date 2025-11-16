import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { getRelationshipsCounts } from "../fns/get-relationships-counts.kysely.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import type { TableRelationship } from "#src/types/relationships.ts";

// Using Record type with any for rowData to avoid schema validation issues
const InputSchema = Schema.Struct({
	url: Schema.String,
	schema: Schema.String,
	table: Schema.String,
	relationships: Schema.Any,
	rowData: Schema.Any,
});

const getRelationshipsCountsServerFn = createServerFn()
	.inputValidator(InputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const input = ctx.data;
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(input.url);

				if (!connection) {
					throw new Error(`Connection not found for URL: ${input.url}`);
				}

				return yield* getRelationshipsCounts({
					schema: input.schema,
					table: input.table,
					relationships: input.relationships as TableRelationship[],
					rowData: input.rowData as Record<string, unknown>,
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
			}),
		);
	});

export const getRelationshipsCountsQueryOptions = (
	input: InferServerFnSchema<typeof getRelationshipsCountsServerFn>,
) =>
	queryOptions({
		queryKey: [
			"pg",
			"relationshipsCounts",
			input.url,
			input.schema,
			input.table,
			JSON.stringify(input.relationships),
			JSON.stringify(input.rowData),
		],
		queryFn: () => getRelationshipsCountsServerFn({ data: input }),
	});
