import { DatabaseDialect } from "#src/db/dialect.ts";
import { createDbConnection } from "#src/server/db-connection/fns/create-db-connection.ts";
import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { AppRuntime } from "../../services/app.runtime.ts";

const createDbConnectionServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      name: Schema.String,
      url: Schema.URL,
      dialect: Schema.Enums(DatabaseDialect),
    }).pipe(Schema.standardSchemaV1),
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
