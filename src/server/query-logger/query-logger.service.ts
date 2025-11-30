import { Effect, Ref } from "effect";
import type { QueryLogEntryType } from "./query-logger.types.ts";

export class QueryLogger extends Effect.Service<QueryLogger>()("QueryLogger", {
	effect: Effect.gen(function* () {
		const entriesRef = yield* Ref.make<QueryLogEntryType[]>([]);

		return {
			get history() {
				return Ref.get(entriesRef);
			},
			addEntry: (entry: Omit<QueryLogEntryType, "id">) =>
				Effect.gen(function* () {
					const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
					yield* Ref.update(entriesRef, (entries) => [
						...entries,
						{ ...entry, id },
					]);
					return id;
				}),
			updateEntry: (id: string, updates: Partial<QueryLogEntryType>) =>
				Ref.update(entriesRef, (entries) =>
					entries.map((entry) =>
						entry.id === id ? { ...entry, ...updates } : entry,
					),
				),
			clearHistory: () => Ref.set(entriesRef, []),
			removeEntry: (id: string) =>
				Ref.update(entriesRef, (entries) =>
					entries.filter((entry) => entry.id !== id),
				),
		};
	}),
}) {}
