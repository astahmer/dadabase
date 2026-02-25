import { deleteDbConnection } from "#src/server/db-connection/fns/delete-db-connection.ts";
import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { AppRuntime } from "../../services/app.runtime.ts";

const deleteDbConnectionServerFn = createServerFn({ method: "POST" })
  .inputValidator(Schema.Struct({ id: Schema.String }).pipe(Schema.standardSchemaV1))
  .handler(async (ctx) => {
    return await AppRuntime.runPromise(deleteDbConnection(ctx.data.id));
  });

export const deleteDbConnectionMutation = mutationOptions({
  mutationFn: deleteDbConnectionServerFn,
});
