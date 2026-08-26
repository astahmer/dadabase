import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getTableIndexes } from "#src/server/introspection/introspection.ts";

const getTableIndexesServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getTableIndexes({
        schema: input.schema,
        table: input.table,
      }),
    ),
  );

export const getTableIndexesQueryOptions = (
  input: InferServerFnSchema<typeof getTableIndexesServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "tableIndexes", input],
    queryFn: () => getTableIndexesServerFn({ data: input }),
    staleTime: 60 * 1000,
  });
