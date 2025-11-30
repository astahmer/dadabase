import type { Effect } from "effect";

export enum QueryLogType {
	TableRows = "table_rows",
	TableCount = "table_count",
	SchemaIntrospection = "schema_introspection",
	ColumnMetadata = "column_metadata",
	ForeignKeyLookup = "foreign_key_lookup",
	RelationshipDiscovery = "relationship_discovery",
	RelationshipCardinality = "relationship_cardinality",
	RelationshipCounting = "relationship_counting",
}

export type QueryLogStatus = "pending" | "success" | "error";

export interface QueryLogEntryType {
	id: string;
	sql: string;
	params?: Record<string, any> | ReadonlyArray<any>;
	type: QueryLogType;
	schema?: string;
	table?: string;
	status: QueryLogStatus;
	startTime: number;
	endTime?: number;
	timeTaken?: number;
	rowsReturned?: number;
	rowsAffected?: number;
	error?: {
		message: string;
		stack?: string;
	};
}

export interface QueryLoggerContext {
	history: QueryLogEntryType[];
	addEntry: (entry: Omit<QueryLogEntryType, "id">) => Effect.Effect<string>;
	updateEntry: (
		id: string,
		updates: Partial<QueryLogEntryType>,
	) => Effect.Effect<void>;
	clearHistory: () => Effect.Effect<void>;
	removeEntry: (id: string) => Effect.Effect<void>;
}
