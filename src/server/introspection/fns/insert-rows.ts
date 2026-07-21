import type { Selectable } from "kysely";

import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { insertRow } from "./insert-row.ts";

export interface InsertRowsInput {
  schema: string;
  table: string;
  rows: Array<Record<string, unknown>>;
}

/**
 * Inserts many rows in a single transaction. Mid-batch failure rolls back all inserts.
 */
export const insertRows = (
  input: InsertRowsInput,
  connection: Selectable<AppDatabaseSchema["database_connections"]>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    if (input.rows.length === 0) {
      return yield* Effect.fail(
        new SqlError({ cause: null, message: "Cannot paste an empty row set" }),
      );
    }

    return yield* sql.withTransaction(
      Effect.gen(function* () {
        let rowsAffected = 0;
        for (const values of input.rows) {
          const result = yield* insertRow(
            { schema: input.schema, table: input.table, values },
            connection,
          );
          rowsAffected += result.rowsAffected;
        }
        return { rowsAffected, inserted: input.rows.length };
      }),
    );
  });
