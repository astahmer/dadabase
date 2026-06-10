import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { updateRow } from "#src/server/introspection/fns/update-row.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const CellValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
);

export const updateRowServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      primaryKey: Schema.Record({ key: Schema.String, value: CellValue }),
      values: Schema.Record({ key: Schema.String, value: CellValue }),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      updateRow(
        {
          schema: input.schema,
          table: input.table,
          primaryKey: input.primaryKey as Record<string, unknown>,
          values: input.values as Record<string, unknown>,
        },
        connection,
      ),
    ),
  );
