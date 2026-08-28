import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { randomUUID } from "node:crypto";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { splitSqlStatements } from "#src/lib/sql-statements.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { createCustomSqlExecution } from "#src/server/custom-sql/fns/create-custom-sql-execution.ts";
import { getCustomSqlExecution } from "#src/server/custom-sql/fns/get-custom-sql-execution.ts";
import {
  updateCustomSqlExecutionError,
  updateCustomSqlExecutionSuccess,
} from "#src/server/custom-sql/fns/update-custom-sql-execution.ts";
import { isSelectQuery } from "#src/server/introspection/detect-destructive-sql.ts";
import {
  executeCustomSql,
  executeCustomSqlTransaction,
} from "#src/server/introspection/introspection.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

import { executeCustomSqlInTransaction } from "../transaction-session.ts";

export const ExecuteAndStoreCustomSqlInputSchema = Schema.Struct({
  url: Schema.String,
  sql: Schema.String,
  schemaName: Schema.optional(Schema.String),
  tableName: Schema.optional(Schema.String),
  previousId: Schema.optional(Schema.String), // Reference to parent execution (for edit chains)
  /** Audit S2: honor the user's record-history preference. */
  skipQueryLog: Schema.optional(Schema.Boolean),
  /** Execute all parsed statements atomically and roll back on failure. */
  transactionMode: Schema.optional(Schema.Boolean),
  /** Execute one statement inside a persistent transaction session. */
  transactionId: Schema.optional(Schema.String),
});

export type ExecuteAndStoreCustomSqlInput = Schema.Schema.Type<
  typeof ExecuteAndStoreCustomSqlInputSchema
>;

/**
 * Execute a custom SQL query and store the execution record
 * Returns the customSqlId which can be used to retrieve the result later
 */
export const executeAndStoreCustomSqlServerFn = createServerFn({
  method: "POST",
})
  .validator(ExecuteAndStoreCustomSqlInputSchema.pipe(toValidator))
  .handler(async (ctx) => {
    const requestId = randomUUID();
    if (ctx.data.transactionId && ctx.data.transactionMode) {
      throw new Error(
        `A query cannot use both a transaction session and atomic mode. (Request ID: ${requestId})`,
      );
    }
    const statements = splitSqlStatements(ctx.data.sql);
    const readOnlyError = guardReadOnlyMutation(ctx.data.url, {
      isSelect:
        statements.length > 0 && statements.every((statement) => isSelectQuery(statement.sql)),
    });
    if (readOnlyError) throw new Error(`${readOnlyError} (Request ID: ${requestId})`);

    // First, create the execution record and get the connection ID
    const { id, connectionId } = await AppRuntime.runPromise(
      Effect.gen(function* () {
        const repo = yield* DatabaseConnectionRepository;
        const connection = yield* repo.findByUrl(ctx.data.url);

        if (!connection) {
          return yield* Effect.fail(new Error(`Connection not found for URL: ${ctx.data.url}`));
        }

        const execution = yield* createCustomSqlExecution({
          connectionId: connection.id,
          schemaName: ctx.data.schemaName,
          tableName: ctx.data.tableName,
          previousId: ctx.data.previousId,
          sql: ctx.data.sql,
        });

        return { id: execution.id, connectionId: connection.id };
      }),
    );

    // Now execute the SQL query using the remote introspection handler
    try {
      const result = ctx.data.transactionId
        ? await executeCustomSqlInTransaction({
            transactionId: ctx.data.transactionId,
            connectionId,
            url: ctx.data.url,
            sql: ctx.data.sql,
          })
        : await createRemoteIntrospectionHandler((input: ExecuteAndStoreCustomSqlInput) =>
            input.transactionMode
              ? executeCustomSqlTransaction({
                  statements: statements.map((statement) => statement.sql),
                  skipQueryLog: input.skipQueryLog,
                })
              : executeCustomSql({ sql: input.sql, skipQueryLog: input.skipQueryLog }),
          )({ data: ctx.data });

      // Update the execution record with success (including the result rows)
      await AppRuntime.runPromise(
        updateCustomSqlExecutionSuccess({
          id,
          rowsReturned: result.rowCount,
          rowsAffected: result.rowsAffected,
          columns: result.columns,
          resultRows: result.rows as Record<string, unknown>[],
          endedAt: result.ranAt + result.timeTaken,
          timeTaken: result.timeTaken,
        }),
      );

      return {
        customSqlId: id,
        rows: result.rows as Record<string, {}>[],
        columns: result.columns,
        rowCount: result.rowCount,
        rowsAffected: result.rowsAffected,
        timeTaken: result.timeTaken,
        ranAt: result.ranAt,
        requestId,
      };
    } catch (error) {
      // Update the execution record with error
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const endedAt = Date.now();

      await AppRuntime.runPromise(
        Effect.gen(function* () {
          const record = yield* getCustomSqlExecution(id);
          const startedAt = record?.startedAt ?? endedAt;

          yield* updateCustomSqlExecutionError({
            id,
            errorMessage,
            endedAt,
            timeTaken: endedAt - startedAt,
          });
        }),
      );

      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        message.includes(requestId) ? message : `${message} (Request ID: ${requestId})`,
      );
    }
  });

const getCustomSqlExecutionServerFn = createServerFn({ method: "GET" })
  .validator(Schema.Struct({ id: Schema.String }).pipe(toValidator))
  .handler((ctx) => AppRuntime.runPromise(getCustomSqlExecution(ctx.data.id)));

export const customSqlExecutionQueryOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: ["custom-sql-execution", id],
    queryFn: () => {
      if (!id) return null;
      return getCustomSqlExecutionServerFn({ data: { id } });
    },
    enabled: !!id,
  });
