import { makeKyselyPgDatabaseLayer } from "#src/db/postgres/kysely.pg.database.live.ts";
import {
	getAvailableDatabases,
	getAvailableTables,
} from "#src/server/introspection/introspection.ts";
import { QueryLoggerInMemoryLayer } from "#src/server/query-logger/query-logger.layer.in-memory.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { PlatformConfigProvider } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Config, Effect } from "effect";

const program = Effect.gen(function* () {
	const dbList = yield* getAvailableDatabases();
	const tableList = yield* getAvailableTables();
	return { dbList, tableList };
});

const DatabaseUrl = Config.string("DB_URL");
const runWithDb = Effect.gen(function* () {
	const url = yield* DatabaseUrl;
	const layer = yield* makeKyselyPgDatabaseLayer(url);
	const result = yield* program.pipe(Effect.provide(layer));
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
