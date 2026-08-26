import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { SqlError, toValidator } from "#src/db/effect-compat.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { bulkDeleteRows } from "#src/server/introspection/fns/bulk-delete-rows.ts";

const CellValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
]);

export const bulkDeleteRowsServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      primaryKeys: Schema.Array(Schema.Record(Schema.String, CellValue)),
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      Effect.gen(function* () {
        const readOnlyError = guardReadOnlyMutation(input.url);
        if (readOnlyError) return yield* Effect.fail(new SqlError({ cause: readOnlyError }));

        return yield* bulkDeleteRows(
          {
            schema: input.schema,
            table: input.table,
            primaryKeys: input.primaryKeys as ReadonlyArray<Record<string, unknown>>,
          },
          connection,
        );
      }),
    ),
  );
