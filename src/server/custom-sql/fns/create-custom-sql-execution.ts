import { Effect } from "effect";
import { CustomSqlExecutionRepository } from "#src/db/custom-sql-execution.repository.ts";
import { NanoId } from "#src/server/services/nano-id.ts";

export interface CreateCustomSqlExecutionInput {
	connectionId: string;
	schemaName?: string;
	tableName?: string;
	sql: string;
}

/**
 * Creates a new custom SQL execution record in pending state
 * Returns the generated ID for tracking
 */
export const createCustomSqlExecution = Effect.fn(function* (
	input: CreateCustomSqlExecutionInput,
) {
	const repository = yield* CustomSqlExecutionRepository;
	const nanoId = yield* NanoId;

	const id = yield* nanoId.generate("csql");
	const now = Date.now();

	yield* repository.insert({
		id,
		connection_id: input.connectionId,
		schema_name: input.schemaName ?? null,
		table_name: input.tableName ?? null,
		sql: input.sql,
		status: "pending",
		rows_returned: null,
		rows_affected: null,
		columns: null,
		error_message: null,
		started_at: now,
		ended_at: null,
		time_taken: null,
		created_at: now,
	});

	return { id };
});
