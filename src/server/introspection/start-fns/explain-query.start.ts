import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

const ExplainInputSchema = Schema.Struct({
  url: Schema.String,
  sql: Schema.String,
});

type ExplainInput = typeof ExplainInputSchema.Type;

/**
 * Server function to explain SQL query execution plan
 * Uses EXPLAIN for PostgreSQL and EXPLAIN QUERY PLAN for SQLite
 */
export const explainQueryServerFn = createServerFn({ method: "POST" })
  .inputValidator(ExplainInputSchema.pipe(Schema.standardSchemaV1))
  .handler(
    createRemoteIntrospectionHandler((input) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Get the EXPLAIN command based on dialect
        const explainResult = yield* sql.onDialectOrElse({
          pg: () =>
            Effect.gen(function* () {
              const result = yield* sql.unsafe(`EXPLAIN ANALYZE ${input.sql}`);
              return {
                plan: (result as Array<Record<string, string>>)
                  .map((row) => {
                    const values = Object.values(row);
                    return values[0] || JSON.stringify(row);
                  })
                  .join("\n"),
                dialect: "postgres" as const,
              };
            }),
          sqlite: () =>
            Effect.gen(function* () {
              const result = yield* sql.unsafe(`EXPLAIN QUERY PLAN ${input.sql}`);
              return {
                plan: (result as Array<Record<string, string>>)
                  .map((row) => {
                    const values = Object.values(row);
                    return values[0] || JSON.stringify(row);
                  })
                  .join("\n"),
                dialect: "sqlite" as const,
              };
            }),
          orElse: () => Effect.fail(new SqlError({ cause: "Unsupported database dialect" })),
        });

        return explainResult;
      }),
    ),
  );

export type ExplainQueryInput = ExplainInput;
export type ExplainQueryResult = {
  plan: string;
  dialect: "postgres" | "sqlite";
};

export const explainQueryQueryOptions = (input: ExplainQueryInput) =>
  queryOptions({
    queryKey: ["explain", input.sql],
    queryFn: async () => explainQueryServerFn({ data: input }),
    enabled: !!input.sql && input.sql.length > 0,
  });
