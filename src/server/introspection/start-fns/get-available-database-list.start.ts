import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableDatabases } from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const getAvailableDatabaseListServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((_input) => getAvailableDatabases()),
	);

export const listAvailableDatabase = (
	input: InferServerFnSchema<typeof getAvailableDatabaseListServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "dbList", input],
		queryFn: () => getAvailableDatabaseListServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
