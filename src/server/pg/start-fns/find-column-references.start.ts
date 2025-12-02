import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { withRemoteConnectionLayers } from "#src/server/create-remote-server-fn.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";
import { RemoteConnectionId } from "#src/server/db-connection/remote-connection.tag.ts";
import {
	findColumnReferences,
	findColumnReferencesWithCounts,
	type ColumnReference,
	type ColumnReferenceWithCount,
} from "#src/server/introspection/introspection.ts";

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
	.handler(async (ctx): Promise<ColumnReference[]> => {
		const program = Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(ctx.data.url);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${ctx.data.url}`),
				);
			}

			return yield* findColumnReferences({
				referencedSchema: ctx.data.referencedSchema,
				referencedTable: ctx.data.referencedTable,
				referencedColumn: ctx.data.referencedColumn,
			}).pipe(
				withRemoteConnectionLayers(
					connection.url,
					RemoteConnectionId.make(connection.id),
				),
			);
		});
		return await AppRuntime.runPromise(program);
	});

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
	.handler(async (ctx): Promise<ColumnReferenceWithCount[]> => {
		const program = Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(ctx.data.url);

			if (!connection) {
				return yield* Effect.fail(
					new Error(`Connection not found for URL: ${ctx.data.url}`),
				);
			}

			return yield* findColumnReferencesWithCounts({
				referencedSchema: ctx.data.referencedSchema,
				referencedTable: ctx.data.referencedTable,
				referencedColumn: ctx.data.referencedColumn,
				cellValue: ctx.data.cellValue,
			}).pipe(
				withRemoteConnectionLayers(
					connection.url,
					RemoteConnectionId.make(connection.id),
				),
			);
		});
		return await AppRuntime.runPromise(program);
	});

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
