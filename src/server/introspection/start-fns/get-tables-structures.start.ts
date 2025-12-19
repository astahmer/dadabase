import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getTablesStructures } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const getTablesStructuresServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			tables: Schema.Array(Schema.String).pipe(Schema.mutable, Schema.optional),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			getTablesStructures({
				schema: input.schema,
				tables: input.tables,
			}),
		),
	);

export const getTablesStructuresQueryOptions = (
	input: InferServerFnSchema<typeof getTablesStructuresServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tablesStructures", input],
		queryFn: () => getTablesStructuresServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
