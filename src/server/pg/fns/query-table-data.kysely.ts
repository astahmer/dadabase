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
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const limit = input.limit ?? 50;
		const offset = input.offset ?? 0;
		const orderBy = input.orderBy;
		const orderDirection = input.orderDirection ?? "asc";

		try {
			// Get total count - use raw SQL for schema-qualified table
			const countResult = yield* db.execute(
				sql<{ count: number }>`SELECT COUNT(*) as count FROM ${sql.ref(
					input.schema,
				)}.${sql.ref(input.table)}`,
			);
			const rowCount = countResult[0]?.count ?? 0;

			// Build the main query using raw SQL for schema-qualified table
			let query = sql<Record<string, any>>`
				SELECT * FROM ${sql.ref(input.schema)}.${sql.ref(input.table)}
			`;

			// Add ordering if specified
			if (orderBy) {
				query = sql<Record<string, any>>`
					${query}
					ORDER BY ${sql.ref(input.schema)}.${sql.ref(input.table)}.${sql.ref(orderBy)} ${
						orderDirection === "desc" ? sql`DESC` : sql`ASC`
					}
				`;
			}

			// Add limit and offset for pagination
			query = sql<Record<string, any>>`
				${query}
				LIMIT ${sql.lit(limit)} OFFSET ${sql.lit(offset)}
			`;

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
