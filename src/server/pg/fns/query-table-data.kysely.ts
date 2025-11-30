import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { sql } from "kysely";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { buildWhereExpression } from "./build-where-expression";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import {
	persistQueryLog,
	updatePersistedQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

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
	connectionId?: string;
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

			const countSql = countQuery.compile().sql;
			const countResult = yield* db.execute(countQuery).pipe(
				withQueryLogging({
					type: QueryLogType.TableCount,
					sql: countSql,
					schema: input.schema,
					table: input.table,
					connectionId: input.connectionId,
					persistFn: persistQueryLog,
					updatePersistFn: updatePersistedQueryLog,
				}),
			);
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

			const mainSql = query.compile().sql;
			console.log("--> Main SQL:", mainSql);
			console.time(`<-- Main SQL: ${mainSql}`);
			const rows = yield* db
				.execute(query as any)
				.pipe(Effect.map((r) => ({ rows: r as T[], rowCount: rowCount })))
				.pipe(
					withQueryLogging({
						type: QueryLogType.TableRows,
						sql: mainSql,
						schema: input.schema,
						table: input.table,
						connectionId: input.connectionId,
						persistFn: persistQueryLog,
						updatePersistFn: updatePersistedQueryLog,
					}),
				)
				.pipe(
					Effect.tap(() =>
						Effect.sync(() => console.timeEnd(`<-- Main SQL: ${mainSql}`)),
					),
				);
			return rows;
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't query table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
