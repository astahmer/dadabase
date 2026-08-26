import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { createDbConnection } from "#src/server/db-connection/fns/create-db-connection.ts";

import { AppRuntime } from "../../services/app.runtime.ts";

const createDbConnectionServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      name: Schema.String,
      url: Schema.String,
      dialect: Schema.Enum(DatabaseDialect),
    }).pipe(toValidator),
  )
  .handler(async (ctx) => {
    return await AppRuntime.runPromise(
      createDbConnection({
        name: ctx.data.name,
        url: ctx.data.url.toString(),
        dialect: ctx.data.dialect,
      }),
    );
  });

export const createDbConnectionMutation = mutationOptions({
  mutationFn: createDbConnectionServerFn,
});
