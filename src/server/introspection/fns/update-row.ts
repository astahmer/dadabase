import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";
import type { Selectable } from "kysely";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";

import { DADABASE_ROW_ID, isDadabaseRowIdKey } from "./row-identity.ts";
import {
  assertSafeIdentifier,
  assertSafeIdentifiers,
  extractRowsAffected,
} from "./row-mutation-utils.ts";

export interface UpdateRowInput {
  schema: string;
  table: string;
  /**
   * Primary key column → value map (supports composite keys).
   * For no-PK tables, pass `{ [DADABASE_ROW_ID]: rowidOrCtid }`.
   */
  primaryKey: Record<string, unknown>;
  /** Column name → new value map (non-PK columns to update). */
  values: Record<string, unknown>;
}

/**
 * Updates a single row by primary key (or system row identity) using parameterized SQL.
 */
export const updateRow = (
  input: UpdateRowInput,
  _connection: Selectable<AppDatabaseSchema["database_connections"]>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    assertSafeIdentifier(input.table, "table");
    if (input.schema) {
      assertSafeIdentifier(input.schema, "schema");
    }

    const pkColumns = Object.keys(input.primaryKey);
    if (pkColumns.length === 0) {
      return yield* Effect.fail(
        new SqlError({ cause: null, message: "Cannot update a row without a primary key" }),
      );
    }

    const usesSystemRowId = pkColumns.length === 1 && isDadabaseRowIdKey(pkColumns[0]!);
    if (!usesSystemRowId) {
      assertSafeIdentifiers(pkColumns, "primary key column");
    }

    const valueColumns = Object.keys(input.values).filter((col) => !isDadabaseRowIdKey(col));
    if (valueColumns.length === 0) {
      return { rowsAffected: 0 };
    }
    assertSafeIdentifiers(valueColumns, "column");

    const valuesForUpdate = Object.fromEntries(
      valueColumns.map((column) => [column, input.values[column]]),
    );

    const whereClause = usesSystemRowId
      ? yield* sql.onDialectOrElse({
          pg: () =>
            Effect.succeed(sql`ctid = CAST(${String(input.primaryKey[DADABASE_ROW_ID])} AS tid)`),
          sqlite: () => Effect.succeed(sql`rowid = ${input.primaryKey[DADABASE_ROW_ID]}`),
          orElse: () => Effect.die(new Error("Unsupported database dialect")),
        })
      : sql.and(pkColumns.map((column) => sql`${sql(column)} = ${input.primaryKey[column]}`));

    const statement = yield* sql.onDialectOrElse({
      pg: () =>
        Effect.succeed(
          input.schema
            ? sql`UPDATE ${sql(input.schema)}.${sql(input.table)} SET ${sql.update(valuesForUpdate)} WHERE ${whereClause}`
            : sql`UPDATE ${sql(input.table)} SET ${sql.update(valuesForUpdate)} WHERE ${whereClause}`,
        ),
      sqlite: () =>
        Effect.succeed(
          sql`UPDATE ${sql(input.table)} SET ${sql.update(valuesForUpdate)} WHERE ${whereClause}`,
        ),
      orElse: () => Effect.die(new Error("Unsupported database dialect")),
    });

    const [compiledSql, params] = statement.compile();

    const result = yield* statement.raw.pipe(
      withQueryLogging({
        type: QueryLogType.TableRows,
        sql: compiledSql,
        params,
        level: QueryLogLevel.Info,
        connectionId,
        schema: input.schema || undefined,
        table: input.table,
        meta: { updateRow: true },
      } as const),
    );

    const rowsAffected = extractRowsAffected(result);
    if (usesSystemRowId && rowsAffected !== 1) {
      return yield* Effect.fail(
        new SqlError({
          cause: null,
          message: `Expected to update 1 row, but updated ${rowsAffected}. Row may have moved; refresh and retry.`,
        }),
      );
    }

    return { rowsAffected };
  });
