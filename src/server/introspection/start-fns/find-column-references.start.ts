import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import {
	findColumnReferences,
	findColumnReferencesWithCounts,
} from "#src/server/introspection/introspection.ts";
import type { InferServerFnSchema } from "#src/types.ts";

/**
 * Find all tables and columns that reference a specific column (reverse FK lookup)
 * This is lazy-loaded to avoid N+1 queries
 */
const findColumnReferencesServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			referencedSchema: Schema.String,
			referencedTable: Schema.String,
			referencedColumn: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			findColumnReferences({
				referencedSchema: input.referencedSchema,
				referencedTable: input.referencedTable,
				referencedColumn: input.referencedColumn,
			}),
		),
	);

/**
 * Find all tables and columns that reference a specific column with row counts
 * Includes count of matching rows in each referencing table for the given cell value
 */
const findColumnReferencesWithCountsServerFn = createServerFn({
	method: "POST",
})
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			referencedSchema: Schema.String,
			referencedTable: Schema.String,
			referencedColumn: Schema.String,
			cellValue: Schema.Any,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		createRemoteIntrospectionHandler((input) =>
			findColumnReferencesWithCounts({
				referencedSchema: input.referencedSchema,
				referencedTable: input.referencedTable,
				referencedColumn: input.referencedColumn,
				cellValue: input.cellValue,
			}),
		),
	);

export const findColumnReferencesQueryOptions = (
	input: InferServerFnSchema<typeof findColumnReferencesServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "columnReferences", input],
		queryFn: () => findColumnReferencesServerFn({ data: input }),
	});

export const findColumnReferencesWithCountsQueryOptions = (
	input: InferServerFnSchema<typeof findColumnReferencesWithCountsServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "columnReferencesWithCounts", input],
		queryFn: () => findColumnReferencesWithCountsServerFn({ data: input }),
	});
