import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { countCascadeDependents } from "#src/server/introspection/fns/count-cascade-dependents.ts";

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
      edges: Schema.Array(
        Schema.Struct({
          childTable: Schema.String,
          childColumn: Schema.String,
          parentValues: Schema.Array(CellValue),
        }),
      ),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      Effect.gen(function* () {
        return yield* countCascadeDependents({
          schema: input.schema,
          edges: input.edges.map((e) => ({
            childTable: e.childTable,
            childColumn: e.childColumn,
            parentValues: e.parentValues as unknown[],
          })),
        });
      }),
    ),
  );
