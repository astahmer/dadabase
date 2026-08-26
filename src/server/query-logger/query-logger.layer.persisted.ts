import { Effect, Layer } from "effect";

import { AppDatabase } from "#src/db/app.db.ts";

import type { QueryLogEntryType, QueryLogFilters } from "./query-logger.types.ts";

import { RemoteConnection } from "../db-connection/remote-connection.tag.ts";
import { NanoId } from "../services/nano-id.ts";
import {
  deleteQueryLog,
  getQueryLogs,
  persistQueryLog,
  updatePersistedQueryLog,
} from "./query-logger.kysely.ts";
import { QueryLogger } from "./query-logger.ts";

export const QueryLoggerPersistentLayer = Layer.effect(
  QueryLogger,
  Effect.gen(function* () {
    const connectionId = yield* RemoteConnection;
    const db = yield* AppDatabase;
    const nanoId = yield* NanoId;

    return QueryLogger.of({
      get: (filters?: QueryLogFilters) =>
        Effect.gen(function* () {
          return yield* getQueryLogs(connectionId, filters, 1000).pipe(
            Effect.tapError((err) =>
              Effect.logDebug(`query-log read skipped: ${String(err).slice(0, 120)}`),
            ),
            Effect.orElseSucceed(() => ({
              rows: [],
              counts: { success: 0, pending: 0, error: 0 },
            })),
          );
        }).pipe(Effect.provideService(AppDatabase, db)),
      push: function (entry: Omit<QueryLogEntryType, "id">): Effect.Effect<string> {
        return Effect.gen(function* () {
          const entryId = yield* nanoId.generate("ql");
          yield* persistQueryLog(connectionId, { ...entry, id: entryId }).pipe(
            Effect.tapError((err) =>
              Effect.logDebug(`query-log insert skipped: ${String(err).slice(0, 120)}`),
            ),
            Effect.orElseSucceed(() => undefined),
          );
          return entryId;
        }).pipe(Effect.provideService(AppDatabase, db));
      },
      update: function (entryId: string, updates: Partial<QueryLogEntryType>): Effect.Effect<void> {
        return updatePersistedQueryLog(entryId, updates)
          .pipe(
            Effect.tapError((err) =>
              Effect.logDebug(`query-log update skipped: ${String(err).slice(0, 120)}`),
            ),
            Effect.orElseSucceed(() => undefined),
          )
          .pipe(Effect.provideService(AppDatabase, db));
      },
      clearAll: function (): Effect.Effect<void> {
        return Effect.gen(function* () {
          yield* db.execute(db.deleteFrom("query_logs").where("id", "is not", null)).pipe(
            Effect.orElseSucceed(() => undefined),
            Effect.tapError((err) =>
              Effect.logDebug(`query-log clear skipped: ${String(err).slice(0, 120)}`),
            ),
          );
        }).pipe(Effect.provideService(AppDatabase, db));
      },
      remove: function (id: string): Effect.Effect<void> {
        return deleteQueryLog(id).pipe(
          Effect.tapError((err) =>
            Effect.logDebug(`query-log remove skipped: ${String(err).slice(0, 120)}`),
          ),
          Effect.orElseSucceed(() => undefined),
          Effect.provideService(AppDatabase, db),
        );
      },
    });
  }),
);
