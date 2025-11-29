export type QueryLogType =
	| "table"
	| "schema"
	| "enum"
	| "constraint"
	| "total"
	| "columns";

export type QueryLogStatus = "pending" | "success" | "error";

export interface QueryLogEntry {
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
	history: QueryLogEntry[];
	addEntry: (entry: Omit<QueryLogEntry, "id">) => string;
	updateEntry: (id: string, updates: Partial<QueryLogEntry>) => void;
	clearHistory: () => void;
	removeEntry: (id: string) => void;
}
