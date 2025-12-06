import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAllTablesColumns } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const getAllTablesColumnsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			getAllTablesColumns({
				schema: input.schema,
			}),
		),
	);

export const getAllTablesColumnsQueryOptions = (
	input: InferServerFnSchema<typeof getAllTablesColumnsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "allTableColumns", input],
		queryFn: () => getAllTablesColumnsServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
