import { Effect, Layer } from "effect";
import type {
	QueryLogEntry,
	QueryLoggerContext,
} from "#src/lib/query-logger.types.ts";
import { NanoId } from "./nano-id.ts";

export class QueryLogger extends Effect.Service<QueryLogger>()("QueryLogger", {
	succeed: makeDefault(),
}) {}

function makeDefault(): QueryLoggerContext {
	let entries: QueryLogEntry[] = [];

	return {
		get history() {
			return entries;
		},
		addEntry: (entry: Omit<QueryLogEntry, "id">) => {
			const id = `ql_${Math.random().toString(36).substr(2, 9)}`;
			entries = [...entries, { ...entry, id }];
			return id;
		},
		updateEntry: (id: string, updates: Partial<QueryLogEntry>) => {
			entries = entries.map((entry) =>
				entry.id === id ? { ...entry, ...updates } : entry,
			);
		},
		clearHistory: () => {
			entries = [];
		},
		removeEntry: (id: string) => {
			entries = entries.filter((entry) => entry.id !== id);
		},
	};
}
