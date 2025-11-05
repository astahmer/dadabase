import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { queryTableData } from "../fns/query-table-data.kysely.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { AppRuntime } from "../../services/app.runtime.ts";

const queryTableDataServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			schema: Schema.String,
			table: Schema.String,
			limit: Schema.optional(Schema.Number),
			offset: Schema.optional(Schema.Number),
			orderBy: Schema.optional(Schema.String),
			orderDirection: Schema.optional(Schema.Literal("asc", "desc")),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(
		async (
			ctx,
		): Promise<{
			rows: Record<string, any>[];
			rowCount: number;
			timeTaken: number;
			ranAt: number;
		}> => {
			const startTime = Date.now();
			const { rows, rowCount } = (await AppRuntime.runPromise(
				Effect.gen(function* () {
					const repo = yield* DatabaseConnectionRepository;
					const connection = yield* repo.findByUrl(ctx.data.url);

					if (!connection) {
						throw new Error(`Connection not found for URL: ${ctx.data.url}`);
					}

					return yield* queryTableData({
						schema: ctx.data.schema,
						table: ctx.data.table,
						limit: ctx.data.limit ?? 50,
						offset: ctx.data.offset ?? 0,
						orderBy: ctx.data.orderBy,
						orderDirection: ctx.data.orderDirection,
					}).pipe(Effect.provide(makeKyselyPgDatabaseLayer(connection.url)));
				}),
			)) as { rows: Record<string, any>[]; rowCount: number };
			const endTime = Date.now();

			return {
				rows,
				rowCount,
				timeTaken: endTime - startTime,
				ranAt: startTime,
			};
		},
	);

export const queryTableDataQueryOptions = (
	input: InferServerFnSchema<typeof queryTableDataServerFn>,
) =>
	queryOptions({
		queryKey: ["pg", "tableData", input],
		queryFn: () => queryTableDataServerFn({ data: input }),
	});
