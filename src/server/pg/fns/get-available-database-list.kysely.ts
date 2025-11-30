import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import {
	persistQueryLog,
	updatePersistedQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

export const getAvailableDatabaseList = (input: { connectionId?: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const query = db.selectFrom("pg_catalog.pg_database").select("datname");
		const compiled = query.compile();
		const rows = yield* db.execute(query).pipe(
			withQueryLogging({
				type: QueryLogType.SchemaIntrospection,
				sql: compiled.sql,
				params: compiled.parameters,
				connectionId: input.connectionId,
				persistFn: persistQueryLog,
				updatePersistFn: updatePersistedQueryLog,
			}),
		);
		return rows;
	});
