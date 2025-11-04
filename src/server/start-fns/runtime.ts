import { makeAppDatabaseLayerFromEnv } from "#src/db/app.db.live.ts";
import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { DotEnvProvider } from "#src/dotenv.runtime.ts";
import { NanoId } from "#src/server/services/nano-id.ts";
import { Layer, ManagedRuntime } from "effect";

const AppLayer = Layer.mergeAll(
	DatabaseConnectionsRepository.Default,
	NanoId.Default,
	DotEnvProvider,
);
export const AppRuntime = ManagedRuntime.make(
	AppLayer.pipe(Layer.provideMerge(makeAppDatabaseLayerFromEnv)),
);
