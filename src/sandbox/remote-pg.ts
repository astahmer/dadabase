import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import { getAvailableDatabaseList } from "#src/server/pg/fns/get-available-database-list.kysely.ts";
import { getAvailableTableList } from "#src/server/pg/fns/get-available-table-list.kysely.ts";
import { PlatformConfigProvider } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Config, Effect } from "effect";

const program = Effect.gen(function* () {
	const dbList = yield* getAvailableDatabaseList;
	const tableList = yield* getAvailableTableList;
	return { dbList, tableList };
});

const DatabaseUrl = Config.string("DB_URL");
const runWithDb = Effect.gen(function* () {
	const url = yield* DatabaseUrl;
	yield* program.pipe(Effect.provide(makeKyselyPgDatabaseLayer(url)));
});

const res = await Effect.runPromise(
	runWithDb.pipe(
		Effect.scoped,
		Effect.provide(PlatformConfigProvider.layerDotEnv(".env")),
		Effect.provide(NodeContext.layer),
	),
);
console.log(res);
