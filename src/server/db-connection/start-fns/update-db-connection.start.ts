import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { updateDbConnection } from "#src/server/db-connection/fns/update-db-connection.ts";

import { AppRuntime } from "../../services/app.runtime.ts";

const updateDbConnectionServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      url: Schema.URL,
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(async (ctx) => {
    return await AppRuntime.runPromise(
      updateDbConnection({
        id: ctx.data.id,
        name: ctx.data.name,
        url: ctx.data.url.toString(),
      }),
    );
  });

export const updateDbConnectionMutation = mutationOptions({
  mutationFn: updateDbConnectionServerFn,
});
