import { CustomSqlExecutionRepository } from "#src/db/custom-sql-execution.repository.ts";
import { Effect } from "effect";

export interface UpdateCustomSqlExecutionSuccessInput {
  id: string;
  rowsReturned: number;
  rowsAffected: number | undefined;
  columns: string[];
  resultRows: Record<string, unknown>[]; // Store the actual rows
  endedAt: number;
  timeTaken: number;
}

export interface UpdateCustomSqlExecutionErrorInput {
  id: string;
  errorMessage: string;
  endedAt: number;
  timeTaken: number;
}

/**
 * Updates a custom SQL execution record with success result
 */
export const updateCustomSqlExecutionSuccess = Effect.fn(function* (
  input: UpdateCustomSqlExecutionSuccessInput,
) {
  const repository = yield* CustomSqlExecutionRepository;

  yield* repository.update({
    id: input.id,
    updates: {
      status: "success",
      rows_returned: input.rowsReturned,
      rows_affected: input.rowsAffected ?? null,
      columns: JSON.stringify(input.columns),
      result_rows: JSON.stringify(input.resultRows),
      ended_at: input.endedAt,
      time_taken: input.timeTaken,
    },
  });

  return { id: input.id };
});

/**
 * Updates a custom SQL execution record with error result
 */
export const updateCustomSqlExecutionError = Effect.fn(function* (
  input: UpdateCustomSqlExecutionErrorInput,
) {
  const repository = yield* CustomSqlExecutionRepository;

  yield* repository.update({
    id: input.id,
    updates: {
      status: "error",
      error_message: input.errorMessage,
      ended_at: input.endedAt,
      time_taken: input.timeTaken,
    },
  });

  return { id: input.id };
});
