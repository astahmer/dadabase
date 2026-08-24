import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { deleteFavorite } from "#src/server/query-logger/query-logger.kysely.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

export const deleteQueryFavoriteServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      id: Schema.String,
    }).pipe(toValidator),
  )
  .handler(async (ctx) => {
    await AppRuntime.runPromise(deleteFavorite(ctx.data.id));
    return { ok: true as const };
  });
