import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";

export const getAvailableDatabaseList = Effect.gen(function* () {
	const db = yield* KyselyPgDatabase;
	const rows = yield* db.execute(
		db.selectFrom("pg_catalog.pg_database").select("datname"),
	);
	return rows;
});
