import { Effect, Layer } from "effect";
import { QueryLogger } from "./query-logger.ts";

export const QueryLoggerNoopLayer = Layer.succeed(
	QueryLogger,
	QueryLogger.of({
		get: Effect.succeed([]),
		push: () => Effect.succeed("xxx"),
		update: () => Effect.void,
		clearAll: () => Effect.void,
		remove: () => Effect.void,
	}),
);
