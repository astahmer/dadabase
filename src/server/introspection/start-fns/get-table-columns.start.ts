import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getTableColumns } from "#src/server/introspection/introspection.ts";

const getTableColumnsServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getTableColumns({
        schema: input.schema,
        table: input.table,
      }),
    ),
  );

export const getTableColumnsQueryOptions = (
  input: InferServerFnSchema<typeof getTableColumnsServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "tableColumns", input],
    queryFn: () => getTableColumnsServerFn({ data: input }),
    staleTime: 60 * 1000, // 1 minute
  });
