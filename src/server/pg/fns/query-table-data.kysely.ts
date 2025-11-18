import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";
import type { QueryFilterType } from "#src/lib/query-filter";
import { buildWhereExpression } from "./build-where-expression";

export const queryTableData = <
	T extends Record<string, any> = Record<string, any>,
>(input: {
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: QueryFilterType;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const limit = input.limit ?? 50;
		const offset = input.offset ?? 0;
		const orderBy = input.orderBy;
		const orderDirection = input.orderDirection ?? "asc";
		const filterConfig = input.filters;

		try {
			const whereExpression = filterConfig
				? buildWhereExpression(
						Array.from(filterConfig.conditions),
						filterConfig.logicalOperator,
					)
				: undefined;

			// Get total count
			let countQuery = db
				.selectFrom(`${input.schema}.${input.table}` as any)
				.select(sql`COUNT(*)::bigint`.as("count"));

			if (whereExpression) {
				countQuery = countQuery.where(whereExpression as any);
			}

			// console.log("Count SQL:", countQuery.compile().sql);
			const countResult = yield* db.execute(countQuery as any);
			const rowCount = (countResult[0] as any)?.count ?? 0;

			// Build the main query
			let query = db
				.selectFrom(`${input.schema}.${input.table}` as any)
				.selectAll();

			if (whereExpression) {
				query = query.where(whereExpression as any);
			}

			// Add ordering if specified
			if (orderBy) {
				query = query.orderBy(
					orderBy,
					orderDirection === "desc" ? "desc" : "asc",
				);
			}

			// Add limit and offset for pagination
			query = query.limit(limit).offset(offset);

			console.log("--> Main SQL:", query.compile().sql);
			console.time(`<-- Main SQL: ${query.compile().sql}`);
			const rows = yield* db.execute(query as any);
			console.timeEnd(`<-- Main SQL: ${query.compile().sql}`);
			return { rows: rows as T[], rowCount };
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't query table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
