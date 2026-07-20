import type { Selectable } from "kysely";

import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import { DADABASE_ROW_ID, isDadabaseRowIdKey } from "./row-identity.ts";
import {
  assertSafeIdentifier,
  assertSafeIdentifiers,
  extractRowsAffected,
} from "./row-mutation-utils.ts";

export interface BulkDeleteRowsInput {
  schema: string;
  table: string;
  /**
   * One primary-key value map per row (supports composite keys).
   * For no-PK tables, each map is `{ [DADABASE_ROW_ID]: rowidOrCtid }`.
   */
  primaryKeys: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Deletes multiple rows by primary key or system row identity with parameterized SQL.
 */
export const bulkDeleteRows = (
  input: BulkDeleteRowsInput,
  _connection: Selectable<AppDatabaseSchema["database_connections"]>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    if (input.primaryKeys.length === 0) {
      return { rowsAffected: 0 };
    }

    assertSafeIdentifier(input.table, "table");
    if (input.schema) {
      assertSafeIdentifier(input.schema, "schema");
    }

    const pkColumns = Object.keys(input.primaryKeys[0] ?? {});
    if (pkColumns.length === 0) {
      return yield* Effect.fail(
        new SqlError({ cause: null, message: "Cannot bulk delete without primary key columns" }),
      );
    }

    const usesSystemRowId = pkColumns.length === 1 && isDadabaseRowIdKey(pkColumns[0] ?? "");
    if (!usesSystemRowId) {
      assertSafeIdentifiers(pkColumns, "primary key column");
      for (const pk of input.primaryKeys) {
        assertSafeIdentifiers(Object.keys(pk), "primary key column");
      }
    }

    const whereClause = usesSystemRowId
      ? yield* sql.onDialectOrElse({
          pg: () =>
            Effect.succeed(
              sql.or(
                input.primaryKeys.map(
                  (pk) => sql`ctid = CAST(${String(pk[DADABASE_ROW_ID])} AS tid)`,
                ),
              ),
            ),
          sqlite: () =>
            Effect.succeed(
              sql.or(input.primaryKeys.map((pk) => sql`rowid = ${pk[DADABASE_ROW_ID]}`)),
            ),
          orElse: () => Effect.die(new Error("Unsupported database dialect")),
        })
      : sql.or(
          input.primaryKeys.map((pk) =>
            sql.and(pkColumns.map((column) => sql`${sql(column)} = ${pk[column]}`)),
          ),
        );

    const statement = yield* sql.onDialectOrElse({
      pg: () =>
        Effect.succeed(
          input.schema
            ? sql`DELETE FROM ${sql(input.schema)}.${sql(input.table)} WHERE ${whereClause}`
            : sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause}`,
        ),
      sqlite: () => Effect.succeed(sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause}`),
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
        meta: { bulkDelete: true },
      } as const),
    );

    return { rowsAffected: extractRowsAffected(result) };
  });
