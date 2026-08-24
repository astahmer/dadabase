import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableSchemas } from "#src/server/introspection/introspection.ts";

const getAvailableSchemasServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
    }).pipe(toValidator),
  )
  .handler(createRemoteIntrospectionHandler((_input) => getAvailableSchemas()));

export const listAvailableSchemasQueryOptions = (
  input: InferServerFnSchema<typeof getAvailableSchemasServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "schemaList", input],
    queryFn: () => getAvailableSchemasServerFn({ data: input }),
    staleTime: 60 * 1000, // 1 minute
  });
