import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import {
	findColumnReferences,
	type ColumnReference,
} from "../fns/get-table-foreign-keys.kysely.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

/**
 * Find all tables and columns that reference a specific column (reverse FK lookup)
 * This is lazy-loaded to avoid N+1 queries
 */
const findColumnReferencesServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			referencedSchema: Schema.String,
			referencedTable: Schema.String,
			referencedColumn: Schema.String,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx): Promise<ColumnReference[]> => {
		return await AppRuntime.runPromise(
			Effect.gen(function* () {
				const repo = yield* DatabaseConnectionRepository;
				const connection = yield* repo.findByUrl(ctx.data.url);

				if (!connection) {
					throw new Error(`Connection not found for URL: ${ctx.data.url}`);
				}

				return yield* findColumnReferences({
					referencedSchema: ctx.data.referencedSchema,
					referencedTable: ctx.data.referencedTable,
					referencedColumn: ctx.data.referencedColumn,
				}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
			}),
		);
	});

export const findColumnReferencesQueryOptions = (
	input: InferServerFnSchema<typeof findColumnReferencesServerFn>,
) =>
	queryOptions({
		queryKey: [
			"pg",
			"columnReferences",
			input.referencedSchema,
			input.referencedTable,
			input.referencedColumn,
		],
		queryFn: () => findColumnReferencesServerFn({ data: input }),
	});
