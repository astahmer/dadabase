import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { countCascadeDependentsWalk } from "#src/server/introspection/fns/count-cascade-dependents.ts";

const CellValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Undefined,
]);

export const countCascadeDependentsServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      rootTable: Schema.String,
      rootRows: Schema.Array(Schema.Record(Schema.String, CellValue)),
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
    }).pipe(toValidator),
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
