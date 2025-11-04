import { Effect } from "effect";
import { getAvailableDatabaseList } from "./get-available-database-list.kysely.ts";
import { getAvailableTableList } from "./get-available-table-list.kysely.ts";
import { testPgConnectionUrl } from "./test-pg-connection.ts";

export class PgService extends Effect.Service<PgService>()("PgService", {
	accessors: true,
	effect: Effect.gen(function* () {
		return {
			getAvailableDatabaseList,
			getAvailableTableList,
			testPgConnectionUrl,
		};
	}),
}) {}
