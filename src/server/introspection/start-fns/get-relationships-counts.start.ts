import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { InferServerFnSchema } from "#src/types.ts";

import { toValidator } from "#src/db/effect-compat.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { getRelationshipsCounts } from "#src/server/introspection/introspection.ts";

const TableRelationshipSchema = Schema.Struct({
  constraintName: Schema.String,
  referencingSchema: Schema.String,
  referencingTable: Schema.String,
  referencingColumn: Schema.String,
  referencedSchema: Schema.String,
  referencedTable: Schema.String,
  referencedColumn: Schema.String,
  type: Schema.Literals(["incoming", "outgoing"]),
});
TableRelationshipSchema.Type satisfies TableRelationship;

const InputSchema = Schema.Struct({
  url: Schema.String,
  schema: Schema.String,
  table: Schema.String,
  relationships: Schema.Array(TableRelationshipSchema).pipe(Schema.mutable),
  rowData: Schema.Record(Schema.String, Schema.Any),
});

const getRelationshipsCountsServerFn = createServerFn({ method: "POST" })
  .validator(InputSchema.pipe(toValidator))
  .handler(
    createRemoteIntrospectionHandler((input) =>
      getRelationshipsCounts({
        schema: input.schema,
        table: input.table,
        relationships: input.relationships,
        rowData: input.rowData,
      }),
    ),
  );

export const getRelationshipsCountsQueryOptions = (
  input: InferServerFnSchema<typeof getRelationshipsCountsServerFn>,
) =>
  queryOptions({
    queryKey: ["remote", "relationshipsCounts", input],
    queryFn: () => getRelationshipsCountsServerFn({ data: input }),
  });
