import type { Selectable } from "kysely";

import { SqlClient } from "@effect/sql";
import { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import {
  assertSafeIdentifier,
  assertSafeIdentifiers,
  extractRowsAffected,
} from "./row-mutation-utils.ts";

export interface InsertRowInput {
  schema: string;
  table: string;
  /** Column name → value map. Omitted columns are left to DB defaults. */
  values: Record<string, unknown>;
}

/**
 * Inserts a single row using parameterized Effect SQL helpers.
 */
export const insertRow = (
  input: InsertRowInput,
  _connection: Selectable<AppDatabaseSchema["database_connections"]>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    assertSafeIdentifier(input.table, "table");
    if (input.schema) {
      assertSafeIdentifier(input.schema, "schema");
    }

    const columnNames = Object.keys(input.values);
    if (columnNames.length === 0) {
      return yield* Effect.fail(
        new SqlError({ cause: null, message: "Cannot insert a row with no values" }),
      );
    }
    assertSafeIdentifiers(columnNames, "column");

    const statement = yield* sql.onDialectOrElse({
      pg: () =>
        Effect.succeed(
          input.schema
            ? sql`INSERT INTO ${sql(input.schema)}.${sql(input.table)} ${sql.insert(input.values)}`
            : sql`INSERT INTO ${sql(input.table)} ${sql.insert(input.values)}`,
        ),
      mysql: () =>
        Effect.succeed(
          input.schema
            ? sql`INSERT INTO ${sql(input.schema)}.${sql(input.table)} ${sql.insert(input.values)}`
            : sql`INSERT INTO ${sql(input.table)} ${sql.insert(input.values)}`,
        ),
      sqlite: () =>
        Effect.succeed(sql`INSERT INTO ${sql(input.table)} ${sql.insert(input.values)}`),
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
        meta: { insertRow: true },
      } as const),
    );

    return { rowsAffected: extractRowsAffected(result) || 1 };
  });
