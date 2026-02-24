import type { InferServerFnSchema } from "#src/types.ts";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableSchemas } from "#src/server/introspection/introspection.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const getAvailableSchemasServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
    }).pipe(Schema.standardSchemaV1),
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
