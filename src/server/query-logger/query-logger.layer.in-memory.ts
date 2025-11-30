import { Effect, Layer, Ref } from "effect";
import { QueryLogger } from "./query-logger.ts";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export const QueryLoggerInMemoryLayer = Layer.effect(
	QueryLogger,
	Effect.gen(function* () {
		const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

		return {
			get: Ref.get(entriesRef),
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
						entries.map((entry) =>
							entry.id === id ? { ...entry, ...updates } : entry,
						),
					);
				}),
			clearAll: () =>
				Effect.gen(function* () {
					yield* Ref.set(entriesRef, []);
				}),
			remove: (id: string) =>
				Effect.gen(function* () {
					yield* Ref.update(entriesRef, (entries) =>
						entries.filter((entry) => entry.id !== id),
					);
				}),
		};
	}),
);
