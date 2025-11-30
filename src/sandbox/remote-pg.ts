import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import { getAvailableDatabaseList } from "#src/server/pg/fns/get-available-database-list.kysely.ts";
import { getAvailableTableList } from "#src/server/pg/fns/get-available-table-list.kysely.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { QueryLoggerInMemoryLayer } from "#src/server/query-logger/query-logger.layer.in-memory.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { PlatformConfigProvider } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

const program = Effect.gen(function* () {
	const dbList = yield* getAvailableDatabaseList({ connectionId: undefined });
	const tableList = yield* getAvailableTableList;
	return { dbList, tableList };
});

const DatabaseUrl = Config.string("DB_URL");
const runWithDb = Effect.gen(function* () {
	const url = yield* DatabaseUrl;
	const result = yield* program.pipe(
		Effect.provide(makeKyselyPgDatabaseLayer(url)),
	);
	return result;
});

const res = await AppRuntime.runPromise(
	runWithDb.pipe(
		Effect.provide(QueryLoggerInMemoryLayer),
		Effect.scoped,
		Effect.provide(PlatformConfigProvider.layerDotEnv(".env")),
		Effect.provide(NodeContext.layer),
	),
);
console.log(res);
