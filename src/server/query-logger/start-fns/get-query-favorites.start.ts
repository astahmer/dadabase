import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { getFavorites } from "#src/server/query-logger/query-logger.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const getQueryFavoritesServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      connectionId: Schema.String,
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(async (ctx) => {
    return await AppRuntime.runPromise(getFavorites(ctx.data.connectionId));
  });

export const getQueryFavoritesQueryOptions = (
  input: InferServerFnSchema<typeof getQueryFavoritesServerFn>,
) =>
  queryOptions({
    queryKey: ["app", "queryFavorites", input],
    queryFn: () => getQueryFavoritesServerFn({ data: input }),
    staleTime: 30 * 1000,
  });
