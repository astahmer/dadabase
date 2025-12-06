import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getTableRelationships } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const getTableRelationshipsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			getTableRelationships({
				schema: input.schema,
				table: input.table,
			}),
		),
	);

export const getTableRelationshipsQueryOptions = (
	input: InferServerFnSchema<typeof getTableRelationshipsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableRelationships", input],
		queryFn: () => getTableRelationshipsServerFn({ data: input }),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
