import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAllTablesColumns } from "#src/server/introspection/introspection.ts";

const getAllTablesColumnsServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getAllTablesColumns({
        schema: input.schema,
      }),
    ),
  );

export const getAllTablesColumnsQueryOptions = (
  input: InferServerFnSchema<typeof getAllTablesColumnsServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "allTableColumns", input],
    queryFn: () => getAllTablesColumnsServerFn({ data: input }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(input.url && input.schema),
  });
