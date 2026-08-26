import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getTableRelationships } from "#src/server/introspection/introspection.ts";

const getTableRelationshipsServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
    }).pipe(toValidator),
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
