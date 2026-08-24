import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getAvailableDatabases } from "#src/server/introspection/introspection.ts";

const getAvailableDatabaseListServerFn = createServerFn({ method: "POST" })
  .validator(Schema.Struct({ url: Schema.String }).pipe(toValidator))
  .handler(createRemoteIntrospectionHandler((_input) => getAvailableDatabases()));

export const listAvailableDatabase = (
  input: InferServerFnSchema<typeof getAvailableDatabaseListServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "dbList", input],
    queryFn: () => getAvailableDatabaseListServerFn({ data: input }),
    staleTime: 60 * 1000, // 1 minute
  });
