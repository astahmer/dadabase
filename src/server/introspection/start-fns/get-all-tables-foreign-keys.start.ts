import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAllTablesForeignKeys } from "#src/server/introspection/introspection.ts";

const getAllTablesForeignKeysServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getAllTablesForeignKeys({
        schema: input.schema,
      }),
    ),
  );

export const getAllTablesForeignKeysQueryOptions = (
  input: InferServerFnSchema<typeof getAllTablesForeignKeysServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "allTablesForeignKeys", input],
    queryFn: () => getAllTablesForeignKeysServerFn({ data: input }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(input.url && input.schema),
  });
