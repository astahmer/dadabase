import { makeKyselyDatabase } from "#src/db/kysely.database.live.ts";
import {
	getAvailableDatabaseList,
	getAvailableTableList,
} from "#src/fns/get-available-database-list.kysely.ts";
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
	yield* program.pipe(Effect.provide(makeKyselyDatabase(url)));
});

const res = await Effect.runPromise(
	runWithDb.pipe(
		Effect.scoped,
		Effect.provide(PlatformConfigProvider.layerDotEnv(".env")),
		Effect.provide(NodeContext.layer),
	),
);
console.log(res);
