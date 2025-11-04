import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";

export const getAvailableSchemas = Effect.gen(function* () {
	const db = yield* KyselyPgDatabase;
	const rows = yield* Effect.tryPromise({
		try: () => db.introspection.getSchemas(),
		catch: (e) =>
			new SqlError.SqlError({ cause: e, message: "Couldn't get schemas" }),
	});
	return rows.map((s) => s.name);
});
