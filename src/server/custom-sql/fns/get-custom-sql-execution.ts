import { Effect } from "effect";
import { CustomSqlExecutionRepository } from "#src/db/custom-sql-execution.repository.ts";

/**
 * Gets a custom SQL execution record by ID
 */
export const getCustomSqlExecution = Effect.fn(function* (id: string) {
	const repository = yield* CustomSqlExecutionRepository;
	const result = yield* repository.findById(id);

	if (!result) {
		return null;
	}

	return {
		id: result.id,
		connectionId: result.connection_id,
		schemaName: result.schema_name,
		tableName: result.table_name,
		sql: result.sql,
		status: result.status,
		rowsReturned: result.rows_returned,
		rowsAffected: result.rows_affected,
		columns: result.columns ? JSON.parse(result.columns) : null,
		errorMessage: result.error_message,
		startedAt: result.started_at,
		endedAt: result.ended_at,
		timeTaken: result.time_taken,
		createdAt: result.created_at,
	};
});

export type CustomSqlExecutionResult = NonNullable<
	Effect.Effect.Success<ReturnType<typeof getCustomSqlExecution>>
>;
