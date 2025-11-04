import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";

export const queryTableData = (input: {
	schema: string;
	table: string;
	limit?: number;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const limit = input.limit ?? 50;

		try {
			const rows = yield* db.execute(
				(db as any)
					.selectFrom(`${input.schema}.${input.table}`)
					.selectAll()
					.limit(limit),
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
