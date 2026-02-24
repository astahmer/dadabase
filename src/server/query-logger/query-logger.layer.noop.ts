import { Effect, Layer } from "effect";

import { QueryLogger } from "./query-logger.ts";

export const QueryLoggerNoopLayer = Layer.succeed(
  QueryLogger,
  QueryLogger.of({
    get: () =>
      Effect.succeed({
        rows: [],
        counts: { success: 0, pending: 0, error: 0 },
      }),
    push: () => Effect.succeed("xxx"),
    update: () => Effect.void,
    clearAll: () => Effect.void,
    remove: () => Effect.void,
  }),
);
