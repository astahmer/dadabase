import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { executeCustomSql } from "#src/server/introspection/introspection.ts";
import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

export const ExecuteCustomSqlInputSchema = Schema.Struct({
  url: Schema.String,
  sql: Schema.String,
});

export const executeCustomSqlServerFn = createServerFn({ method: "POST" })
  .inputValidator(ExecuteCustomSqlInputSchema.pipe(Schema.standardSchemaV1))
  .handler(
    createRemoteIntrospectionHandler((input) =>
      Effect.gen(function* () {
        const startTime = Date.now();

        const result = yield* executeCustomSql({
          sql: input.sql,
        });

        const endTime = Date.now();

        const rows = result.rows.map((row) => {
          if (typeof row !== "object" || row === null) return {} as any;
          const record: Record<string, unknown> = {};
          result.columns.forEach((col) => {
            record[col] = (row as Record<string, unknown>)[col];
          });
          return record as any;
        }) as any[];
        console.log({
          rows: rows,
          columns: result.columns,
          rowCount: result.rowCount,
          rowsAffected: result.rowsAffected,
          timeTaken: endTime - startTime,
          ranAt: startTime,
        });

        return {
          rows: rows,
          columns: result.columns,
          rowCount: result.rowCount,
          rowsAffected: result.rowsAffected,
          timeTaken: endTime - startTime,
          ranAt: startTime,
        };
      }),
    ),
  );

export type ExecuteCustomSqlInput = {
  url: string;
  sql: string;
};

export const executeCustomSqlMutationOptions = mutationOptions({
  mutationFn: executeCustomSqlServerFn,
  meta: { noInvalidate: true },
});
