import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableTables } from "#src/server/introspection/introspection.ts";

const getAvailableTablesServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.optional(Schema.String),
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) => getAvailableTables({ schema: input.schema })),
  );

export const listAvailableTablesQueryOptions = (
  input: InferServerFnSchema<typeof getAvailableTablesServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "tableList", input],
    queryFn: () => getAvailableTablesServerFn({ data: input }),
    staleTime: 60 * 1000, // 1 minute
  });
