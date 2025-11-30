import { makeAppDatabaseLayerFromEnv } from "#src/db/app.db.live.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { DotEnvProvider } from "#src/dotenv.runtime.ts";
import { makePoolCacheLive } from "#src/db/postgres/pool-cache.ts";
import { NanoId } from "#src/server/services/nano-id.ts";
import { Layer, ManagedRuntime } from "effect";
import { QueryLogger } from "../query-logger/query-logger.service.ts";

const AppLayer = Layer.mergeAll(
	DatabaseConnectionRepository.Default,
	NanoId.Default,
	DotEnvProvider,
	makePoolCacheLive,
	QueryLogger.Default,
);
export const AppRuntime = ManagedRuntime.make(
	AppLayer.pipe(Layer.provideMerge(makeAppDatabaseLayerFromEnv)),
);
