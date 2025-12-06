import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableTables } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const getAvailableTablesServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.optional(Schema.String),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			getAvailableTables({ schema: input.schema }),
		),
	);

export const listAvailableTablesQueryOptions = (
	input: InferServerFnSchema<typeof getAvailableTablesServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "tableList", input],
		queryFn: () => getAvailableTablesServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
