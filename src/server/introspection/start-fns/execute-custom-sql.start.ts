import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { randomUUID } from "node:crypto";

import { SqlError, toValidator } from "#src/db/effect-compat.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { isReadOnlyQuery } from "#src/server/introspection/detect-destructive-sql.ts";
import { executeCustomSql } from "#src/server/introspection/introspection.ts";

export const ExecuteCustomSqlInputSchema = Schema.Struct({
  url: Schema.String,
  sql: Schema.String,
  skipQueryLog: Schema.optional(Schema.Boolean),
});

export const executeCustomSqlServerFn = createServerFn({ method: "POST" })
  .validator(ExecuteCustomSqlInputSchema.pipe(toValidator))
  .handler(async (ctx) => {
    const requestId = randomUUID();
    try {
      return await createRemoteIntrospectionHandler(
        (input: { url: string; sql: string; skipQueryLog?: boolean }) =>
          Effect.gen(function* () {
            if (isReadOnlyConnection(input.url) && !isReadOnlyQuery(input.sql)) {
              return yield* Effect.fail(
                new SqlError({ cause: "This connection is read-only. Mutations are disabled." }),
              );
            }

            const startTime = Date.now();

            const result = yield* executeCustomSql({
              sql: input.sql,
              skipQueryLog: input.skipQueryLog,
            });

            const endTime = Date.now();

            const rows = result.rows.map((row) => {
              if (typeof row !== "object" || row === null) return {} as any;
              const record: Record<string, unknown> = {};
              result.columns.forEach((col) => {
                record[col] = (row as Record<string, unknown>)[col];
              });
              return record as any;
            });

            return {
              rows: rows,
              columns: result.columns,
              rowCount: result.rowCount,
              rowsAffected: result.rowsAffected,
              timeTaken: endTime - startTime,
              ranAt: startTime,
              requestId,
            };
          }),
      )({ data: ctx.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        message.includes(requestId) ? message : `${message} (Request ID: ${requestId})`,
      );
    }
  });

export type ExecuteCustomSqlInput = {
  url: string;
  sql: string;
};

export const executeCustomSqlMutationOptions = mutationOptions({
  mutationFn: executeCustomSqlServerFn,
  meta: { noInvalidate: true },
});
