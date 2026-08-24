import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { getFavorites } from "#src/server/query-logger/query-logger.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const getQueryFavoritesServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      connectionId: Schema.String,
    }).pipe(toValidator),
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
