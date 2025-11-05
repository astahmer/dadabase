import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";

export const queryTableData = (input: {
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	whereClause?: string;
	whereParams?: Record<string, any>;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const limit = input.limit ?? 50;
		const offset = input.offset ?? 0;
		const orderBy = input.orderBy;
		const orderDirection = input.orderDirection ?? "asc";
		const whereClause = input.whereClause;

		try {
			// Get total count - use raw SQL for schema-qualified table
			let countSql = sql<{
				count: number;
			}>`SELECT COUNT(*) as count FROM ${sql.ref(
				input.schema,
			)}.${sql.ref(input.table)}`;

			if (whereClause) {
				countSql = sql<{
					count: number;
				}>`${countSql} WHERE ${sql.raw(whereClause)}`;
			}

			const countResult = yield* db.execute(countSql);
			const rowCount = countResult[0]?.count ?? 0;

			// Build the main query using raw SQL for schema-qualified table
			let query = sql<Record<string, any>>`SELECT * FROM ${sql.ref(
				input.schema,
			)}.${sql.ref(input.table)}`;

			if (whereClause) {
				query = sql<Record<string, any>>`${query} WHERE ${sql.raw(
					whereClause,
				)}`;
			}

			// Add ordering if specified
			if (orderBy) {
				query = sql<Record<string, any>>`${query} ORDER BY ${sql.ref(
					input.schema,
				)}.${sql.ref(input.table)}.${sql.ref(orderBy)} ${
					orderDirection === "desc" ? sql`DESC` : sql`ASC`
				}`;
			}

			// Add limit and offset for pagination
			query = sql<Record<string, any>>`${query} LIMIT ${sql.lit(
				limit,
			)} OFFSET ${sql.lit(offset)}`;

			const rows = yield* db.execute(query);
			return { rows, rowCount };
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't query table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
