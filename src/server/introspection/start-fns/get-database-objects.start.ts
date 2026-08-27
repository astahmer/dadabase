import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getDatabaseObjects } from "#src/server/introspection/introspection.ts";

const getDatabaseObjectsServerFn = createServerFn({ method: "POST" })
	.validator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.optional(Schema.String),
		}).pipe(toValidator),
	)
	.handler(
		createRemoteIntrospectionHandler((input) => getDatabaseObjects({ schema: input.schema })),
	);

export const getDatabaseObjectsQueryOptions = (
	input: InferServerFnSchema<typeof getDatabaseObjectsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "databaseObjects", input],
		queryFn: () => getDatabaseObjectsServerFn({ data: input }),
		staleTime: 5 * 60 * 1000,
		enabled: Boolean(input.url),
	});

