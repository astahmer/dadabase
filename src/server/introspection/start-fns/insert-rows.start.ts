import { SqlError } from "@effect/sql/SqlError";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { insertRows } from "#src/server/introspection/fns/insert-rows.ts";

const CellValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
);

export const insertRowsServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      rows: Schema.Array(Schema.Record({ key: Schema.String, value: CellValue })),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      Effect.gen(function* () {
        const readOnlyError = guardReadOnlyMutation(input.url);
        if (readOnlyError) return yield* Effect.fail(new SqlError({ cause: readOnlyError }));

        return yield* insertRows(
          {
            schema: input.schema,
            table: input.table,
            rows: input.rows as Array<Record<string, unknown>>,
          },
          connection,
        );
      }),
    ),
  );
