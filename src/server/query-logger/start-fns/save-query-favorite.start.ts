import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { saveFavorite } from "#src/server/query-logger/query-logger.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

export const saveQueryFavoriteServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      connectionId: Schema.String,
      label: Schema.String,
      sql: Schema.String,
      description: Schema.optional(Schema.String),
    }).pipe(toValidator),
  )
  .handler(async (ctx) => {
    return await AppRuntime.runPromise(saveFavorite(ctx.data));
  });
