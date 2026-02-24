import { Effect, Layer, Ref } from "effect";

import type { QueryLogEntryType, QueryLogFilters } from "./query-logger.types.ts";

import { QueryLogger } from "./query-logger.ts";

export const QueryLoggerInMemoryLayer = Layer.effect(
  QueryLogger,
  Effect.gen(function* () {
    const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

    const applyFilters = (entries: QueryLogEntryType[], filters?: QueryLogFilters) => {
      let filtered = entries;

      if (filters?.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        filtered = filtered.filter((e) => types.includes(e.type));
      }

      if (filters?.level) {
        const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
        filtered = filtered.filter((e) => levels.includes(e.level));
      }

      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        filtered = filtered.filter((e) => statuses.includes(e.status));
      }

      if (filters?.schema) {
        filtered = filtered.filter((e) => e.schema === filters.schema);
      }

      if (filters?.table) {
        filtered = filtered.filter((e) => e.table === filters.table);
      }

      return filtered;
    };

    return {
      get: (filters?: QueryLogFilters) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef);
          const rows = applyFilters(entries, filters);
          return {
            rows,
            counts: {
              success: rows.filter((e) => e.status === "success").length,
              pending: rows.filter((e) => e.status === "pending").length,
              error: rows.filter((e) => e.status === "error").length,
            },
          };
        }),
      push: (entry: Omit<QueryLogEntryType, "id">) =>
        Effect.gen(function* () {
          const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
          const fullEntry = { ...entry, id };

          yield* Ref.update(entriesRef, (entries) => entries.concat(fullEntry));

          return id;
        }),
      update: (id: string, updates: Partial<QueryLogEntryType>) =>
        Effect.gen(function* () {
          yield* Ref.update(entriesRef, (entries) =>
            entries.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)),
          );
        }),
      clearAll: () =>
        Effect.gen(function* () {
          yield* Ref.set(entriesRef, []);
        }),
      remove: (id: string) =>
        Effect.gen(function* () {
          yield* Ref.update(entriesRef, (entries) => entries.filter((entry) => entry.id !== id));
        }),
    };
  }),
);
