import { Context, Effect } from "effect";
import type {
	QueryLogEntryType,
	QueryLogFilters,
} from "./query-logger.types.ts";

export interface QueryLoggerInterface {
	get: (
		filters?: QueryLogFilters,
	) => Effect.Effect<QueryLogEntryType[], never, never>;
	push: (
		entry: Omit<QueryLogEntryType, "id">,
	) => Effect.Effect<string, never, never>;
	update: (
		id: string,
		updates: Partial<QueryLogEntryType>,
	) => Effect.Effect<void, never, never>;
	clearAll: () => Effect.Effect<void, never, never>;
	remove: (id: string) => Effect.Effect<void, never, never>;
}

export class QueryLogger extends Context.Tag("@dadabase/QueryLogger")<
	QueryLogger,
	QueryLoggerInterface
>() {}
