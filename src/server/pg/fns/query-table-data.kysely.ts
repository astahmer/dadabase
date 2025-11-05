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
		const whereParams = input.whereParams || {};

		try {
			// Substitute parameters directly into the WHERE clause for safe execution
			const whereClauseWithParams = whereClause
				? whereClause.replace(/\$(\d+)/g, (_, num) => {
						const key = `$${num}`;
						const value = whereParams[key];
						if (value === null || value === undefined) {
							return "NULL";
						}
						// Properly escape and quote string values
						if (typeof value === "string") {
							return `'${value.replace(/'/g, "''")}'`;
						}
						if (Array.isArray(value)) {
							const escaped = value
								.map((v) => {
									if (typeof v === "string") {
										return `'${v.replace(/'/g, "''")}'`;
									}
									return String(v);
								})
								.join(", ");
							return `(${escaped})`;
						}
						return String(value);
					})
				: null;

			// Build count query with WHERE clause using raw SQL
			let countSql = sql<{
				count: number;
			}>`SELECT COUNT(*) as count FROM ${sql.ref(
				input.schema,
			)}.${sql.ref(input.table)}`;

			if (whereClauseWithParams) {
				countSql = sql<{ count: number }>`${countSql} WHERE ${sql.raw(
					whereClauseWithParams,
				)}`;
			}

			console.log("Count SQL:", countSql.compile(db).sql);
			const countResult = yield* db.execute(countSql);
			const rowCount = countResult[0]?.count ?? 0;

			// Build the main query using raw SQL
			let query = sql<Record<string, any>>`SELECT * FROM ${sql.ref(
				input.schema,
			)}.${sql.ref(input.table)}`;

			if (whereClauseWithParams) {
				query = sql<Record<string, any>>`${query} WHERE ${sql.raw(
					whereClauseWithParams,
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

			console.log("Main SQL:", query.compile(db).sql);
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
