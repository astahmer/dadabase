import type { InferServerFnSchema } from "#src/types.ts";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAllTablesForeignKeys } from "#src/server/introspection/introspection.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const getAllTablesForeignKeysServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
    }).pipe(Schema.standardSchemaV1),
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
