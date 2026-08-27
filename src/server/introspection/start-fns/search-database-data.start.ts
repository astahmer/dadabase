import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { searchDatabaseData } from "#src/server/introspection/introspection.ts";

const searchDatabaseDataServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.optional(Schema.String),
      term: Schema.String,
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      searchDatabaseData({ schema: input.schema, term: input.term }),
    ),
  );

export const searchDatabaseDataQueryOptions = (
  input: InferServerFnSchema<typeof searchDatabaseDataServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "databaseSearch", input],
    queryFn: () => searchDatabaseDataServerFn({ data: input }),
    enabled: Boolean(input.url && input.term.trim()),
    staleTime: 30 * 1000,
  });
