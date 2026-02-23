import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { bulkDeleteRows } from "#src/server/introspection/fns/bulk-delete-rows.ts";

const bulkDeleteRowsServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
			primaryKeyColumn: Schema.String,
			ids: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			bulkDeleteRows({
				schema: input.schema,
				table: input.table,
				primaryKeyColumn: input.primaryKeyColumn,
				ids: input.ids,
			}),
		),
	);

export { bulkDeleteRowsServerFn };
