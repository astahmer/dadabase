import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";

export const getAvailableTableList = Effect.gen(function* () {
	const db = yield* KyselyPgDatabase;
	const tables = yield* Effect.tryPromise({
		try: () => db.introspection.getTables(),
		catch: (e) =>
			new SqlError.SqlError({
				cause: e,
				message: "Couldn't get table list",
			}),
	});
	return tables;
});
