import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { bulkDeleteRows } from "#src/server/introspection/fns/bulk-delete-rows.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const CellValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
);

export const bulkDeleteRowsServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      primaryKeys: Schema.Array(Schema.Record({ key: Schema.String, value: CellValue })),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      bulkDeleteRows(
        {
          schema: input.schema,
          table: input.table,
          primaryKeys: input.primaryKeys as ReadonlyArray<Record<string, unknown>>,
        },
        connection,
      ),
    ),
  );
