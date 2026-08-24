import type { Selectable } from "kysely";

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { SqlError } from "#src/db/effect-compat.ts";
import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import { listMysqlTableColumnNames } from "./list-mysql-table-column-names.ts";
import { buildMysqlRowFingerprintExpr } from "./mysql-row-fingerprint.ts";
import {
  buildMssqlRowFingerprintExpr,
  listMssqlTableColumnNames,
} from "./mssql-row-fingerprint.ts";
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
      ? _connection.dialect === DatabaseDialect.DuckDB ||
        _connection.dialect === DatabaseDialect.Csv
        ? // DuckDB base tables expose a `rowid` pseudo-column (no ctid).
          sql.or(input.primaryKeys.map((pk) => sql`rowid = ${pk[DADABASE_ROW_ID]}`))
        : yield* sql.onDialectOrElse({
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
            mysql: () =>
              Effect.gen(function* () {
                const columnNames = yield* listMysqlTableColumnNames({
                  schema: input.schema,
                  table: input.table,
                });
                const expr = buildMysqlRowFingerprintExpr(columnNames);
                return sql.or(
                  input.primaryKeys.map(
                    (pk) => sql`${sql.unsafe(expr)} = ${String(pk[DADABASE_ROW_ID])}`,
                  ),
                );
              }),
            mssql: () =>
              Effect.gen(function* () {
                const columnNames = yield* listMssqlTableColumnNames({
                  schema: input.schema || "dbo",
                  table: input.table,
                });
                const expr = buildMssqlRowFingerprintExpr(columnNames);
                return sql.or(
                  input.primaryKeys.map(
                    (pk) => sql`${sql.unsafe(expr)} = ${String(pk[DADABASE_ROW_ID])}`,
                  ),
                );
              }),
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
      mysql: () =>
        Effect.succeed(
          // Cap deletes when using fingerprint identity (collision safety).
          usesSystemRowId
            ? input.schema
              ? sql`DELETE FROM ${sql(input.schema)}.${sql(input.table)} WHERE ${whereClause} LIMIT ${input.primaryKeys.length}`
              : sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause} LIMIT ${input.primaryKeys.length}`
            : input.schema
              ? sql`DELETE FROM ${sql(input.schema)}.${sql(input.table)} WHERE ${whereClause}`
              : sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause}`,
        ),
      sqlite: () => Effect.succeed(sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause}`),
      mssql: () =>
        // T-SQL has no DELETE ... LIMIT — fingerprint collisions could delete extra
        // rows; documented gap for no-PK tables (same as UPDATE path).
        Effect.succeed(
          input.schema
            ? sql`DELETE FROM ${sql(input.schema)}.${sql(input.table)} WHERE ${whereClause}`
            : sql`DELETE FROM ${sql(input.table)} WHERE ${whereClause}`,
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
        meta: { bulkDelete: true },
      } as const),
    );

    return { rowsAffected: extractRowsAffected(result) };
  });
