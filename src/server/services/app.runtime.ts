import { Layer, ManagedRuntime } from "effect";
import { makeAppDatabaseLayerFromEnv } from "#src/db/app.db.live.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { makePoolCacheLive } from "#src/db/postgres/pool-cache.ts";
import { DotEnvProvider } from "#src/dotenv.runtime.ts";
import { NanoId } from "#src/server/services/nano-id.ts";

const AppLayer = Layer.mergeAll(
	DatabaseConnectionRepository.Default,
	NanoId.Default,
	DotEnvProvider,
	makePoolCacheLive,
);
export const AppRuntime = ManagedRuntime.make(
	AppLayer.pipe(Layer.provideMerge(makeAppDatabaseLayerFromEnv)),
);
