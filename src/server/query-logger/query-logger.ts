import { Context, Effect } from "effect";

import type { QueryLogEntryType, QueryLogFilters } from "./query-logger.types.ts";

export interface QueryLogCounts {
  success: number;
  pending: number;
  error: number;
}

export interface QueryLoggerInterface {
  get: (filters?: QueryLogFilters) => Effect.Effect<
    {
      rows: QueryLogEntryType[];
      counts: QueryLogCounts;
    }
  >;
  push: (entry: Omit<QueryLogEntryType, "id">) => Effect.Effect<string>;
  update: (id: string, updates: Partial<QueryLogEntryType>) => Effect.Effect<void>;
  clearAll: () => Effect.Effect<void>;
  remove: (id: string) => Effect.Effect<void>;
}

export class QueryLogger extends Context.Tag("@dadabase/QueryLogger")<
  QueryLogger,
  QueryLoggerInterface
>() {}
