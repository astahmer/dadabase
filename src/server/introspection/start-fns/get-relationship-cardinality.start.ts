import type { InferServerFnSchema } from "#src/types.ts";

import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getRelationshipCardinality } from "#src/server/introspection/introspection.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const getRelationshipCardinalityServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.Struct({
      url: Schema.String,
      schema: Schema.String,
      table: Schema.String,
      columns: Schema.Array(Schema.String),
      isIncomingRelationship: Schema.optional(Schema.Boolean),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getRelationshipCardinality({
        schema: input.schema,
        table: input.table,
        columns: Array.from(input.columns),
        isIncomingRelationship: input.isIncomingRelationship,
      }),
    ),
  );

export const getRelationshipCardinalityQueryOptions = (
  input: InferServerFnSchema<typeof getRelationshipCardinalityServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "relationshipCardinality", input],
    queryFn: () => getRelationshipCardinalityServerFn({ data: input }),
    staleTime: 30 * 60 * 1000, // 30 minutes (schema changes infrequently)
  });
