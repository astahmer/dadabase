import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { countCascadeDependentsWalk } from "#src/server/introspection/fns/count-cascade-dependents.ts";

const CellValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
);

export const countCascadeDependentsServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      rootTable: Schema.String,
      rootRows: Schema.Array(Schema.Record({ key: Schema.String, value: CellValue })),
      edges: Schema.Array(
        Schema.Struct({
          viaTable: Schema.String,
          childTable: Schema.String,
          childColumns: Schema.Array(Schema.String),
          parentColumns: Schema.Array(Schema.String),
          seedChildren: Schema.Boolean,
          seedColumns: Schema.optional(Schema.Array(Schema.String)),
        }),
      ),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      Effect.gen(function* () {
        return yield* countCascadeDependentsWalk({
          schema: input.schema,
          rootTable: input.rootTable,
          rootRows: input.rootRows as Array<Record<string, unknown>>,
          edges: input.edges,
        });
      }),
    ),
  );
