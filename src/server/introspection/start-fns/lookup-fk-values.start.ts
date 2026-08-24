import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { lookupFkValues } from "#src/server/introspection/fns/lookup-fk-values.ts";

export const lookupFkValuesServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      valueColumn: Schema.String,
      labelColumn: Schema.optional(Schema.String),
      search: Schema.optional(Schema.String),
      limit: Schema.optional(Schema.Number),
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input, connection) =>
      lookupFkValues(
        {
          schema: input.schema,
          table: input.table,
          valueColumn: input.valueColumn,
          labelColumn: input.labelColumn,
          search: input.search,
          limit: input.limit,
        },
        connection,
      ),
    ),
  );
