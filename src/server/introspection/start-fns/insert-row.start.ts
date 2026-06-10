import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { insertRow } from "#src/server/introspection/fns/insert-row.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const CellValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
);

export const insertRowServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      values: Schema.Record({ key: Schema.String, value: CellValue }),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      insertRow(
        {
          schema: input.schema,
          table: input.table,
          values: input.values as Record<string, unknown>,
        },
        connection,
      ),
    ),
  );
