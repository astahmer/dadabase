import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { RemoteConnectionId } from "#src/server/db-connection/remote-connection.tag.ts";
import { getRelationshipsCounts } from "#src/server/introspection/introspection.ts";

const TableRelationshipSchema = Schema.Struct({
	constraintName: Schema.String,
	referencingSchema: Schema.String,
	referencingTable: Schema.String,
	referencingColumn: Schema.String,
	referencedSchema: Schema.String,
	referencedTable: Schema.String,
	referencedColumn: Schema.String,
	type: Schema.Literal("incoming", "outgoing"),
});
TableRelationshipSchema.Type satisfies TableRelationship;

const InputSchema = Schema.Struct({
	url: Schema.String,
	schema: Schema.String,
	table: Schema.String,
	relationships: TableRelationshipSchema.pipe(Schema.Array, Schema.mutable),
	rowData: Schema.Record({ key: Schema.String, value: Schema.Any }),
});

const getRelationshipsCountsServerFn = createServerFn({ method: "POST" })
	.inputValidator(InputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const input = ctx.data;
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(input.url);

				if (!connection) {
					return yield* Effect.fail(
						new Error(`Connection not found for URL: ${input.url}`),
					);
				}

				return yield* getRelationshipsCounts({
					schema: input.schema,
					table: input.table,
					relationships: input.relationships,
					rowData: input.rowData,
				}).pipe(
					withRemoteConnectionLayers(
						connection.url,
						RemoteConnectionId.make(connection.id),
					),
				);
			}),
		);
	});

export const getRelationshipsCountsQueryOptions = (
	input: InferServerFnSchema<typeof getRelationshipsCountsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "relationshipsCounts", input],
		queryFn: () => getRelationshipsCountsServerFn({ data: input }),
	});
