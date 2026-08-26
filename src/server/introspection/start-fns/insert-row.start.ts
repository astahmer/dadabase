import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { SqlError, toValidator } from "#src/db/effect-compat.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { insertRow } from "#src/server/introspection/fns/insert-row.ts";

const CellValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
]);

export const insertRowServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      values: Schema.Record(Schema.String, CellValue),
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      Effect.gen(function* () {
        const readOnlyError = guardReadOnlyMutation(input.url);
        if (readOnlyError) return yield* Effect.fail(new SqlError({ cause: readOnlyError }));

        return yield* insertRow(
          {
            schema: input.schema,
            table: input.table,
            values: input.values as Record<string, unknown>,
          },
          connection,
        );
      }),
    ),
  );
