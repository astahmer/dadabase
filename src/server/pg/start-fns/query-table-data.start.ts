import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { queryTableData } from "../fns/query-table-data.kysely.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import type {
	FilterConditionExpression,
	LogicalOperator,
	QueryFilterType,
} from "#src/lib/query-filter";

// Using Record type with any for now to avoid schema validation issues
const queryTableDataServerFn = createServerFn().handler(async (ctx: any) => {
	const input = ctx.data as {
		url: string;
		schema: string;
		table: string;
		limit?: number;
		offset?: number;
		orderBy?: string;
		orderDirection?: "asc" | "desc";
		filters?: {
			conditions: FilterConditionExpression[];
			logicalOperator: LogicalOperator;
		};
	};

	const startTime = Date.now();
	const { rows, rowCount } = (await AppRuntime.runPromise(
		Effect.gen(function* () {
			const repo = yield* DatabaseConnectionRepository;
			const connection = yield* repo.findByUrl(input.url);

			if (!connection) {
				throw new Error(`Connection not found for URL: ${input.url}`);
			}

			return yield* queryTableData({
				schema: input.schema,
				table: input.table,
				limit: input.limit ?? 50,
				offset: input.offset ?? 0,
				orderBy: input.orderBy,
				orderDirection: input.orderDirection,
				filters: input.filters,
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
});

export type QueryTableDataInput = {
	url: string;
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: QueryFilterType;
};

export const queryTableDataQueryOptions = (input: QueryTableDataInput) =>
	queryOptions({
		queryKey: [
			"pg",
			"tableData",
			input.url,
			input.schema,
			input.table,
			input.limit ?? 50,
			input.offset ?? 0,
			input.orderBy,
			input.orderDirection,
			JSON.stringify(
				input.filters ?? { conditions: [], logicalOperator: "and" },
			),
		],
		queryFn: async () => queryTableDataServerFn({ data: input as any }),
	});
