import type { Selectable } from "kysely";

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import { assertSafeIdentifier } from "./row-mutation-utils.ts";

export interface LookupFkValuesInput {
  schema: string;
  table: string;
  valueColumn: string;
  /** Optional display column; defaults to valueColumn. */
  labelColumn?: string;
  search?: string;
  limit?: number;
}

export interface FkLookupOption {
  value: string | number | boolean | null;
  label: string;
}

/**
 * Paginated/searchable lookup of foreign-key reference values for form pickers.
 */
export const lookupFkValues = (
  input: LookupFkValuesInput,
  _connection: Selectable<AppDatabaseSchema["database_connections"]>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    assertSafeIdentifier(input.table, "table");
    assertSafeIdentifier(input.valueColumn, "column");
    if (input.schema) {
      assertSafeIdentifier(input.schema, "schema");
    }

    const labelColumn = input.labelColumn ?? input.valueColumn;
    assertSafeIdentifier(labelColumn, "column");

    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const search = input.search?.trim();

    const statement = yield* sql.onDialectOrElse({
      pg: () => {
        const from = input.schema
          ? sql`${sql(input.schema)}.${sql(input.table)}`
          : sql`${sql(input.table)}`;

        if (search) {
          const pattern = `%${search}%`;
          return Effect.succeed(
            sql`
              SELECT ${sql(input.valueColumn)} AS value, ${sql(labelColumn)} AS label
              FROM ${from}
              WHERE CAST(${sql(labelColumn)} AS TEXT) ILIKE ${pattern}
                 OR CAST(${sql(input.valueColumn)} AS TEXT) ILIKE ${pattern}
              ORDER BY ${sql(labelColumn)}
              LIMIT ${limit}
            `,
          );
        }

        return Effect.succeed(
          sql`
            SELECT ${sql(input.valueColumn)} AS value, ${sql(labelColumn)} AS label
            FROM ${from}
            ORDER BY ${sql(labelColumn)}
            LIMIT ${limit}
          `,
        );
      },
      sqlite: () => {
        if (search) {
          const pattern = `%${search}%`;
          return Effect.succeed(
            sql`
              SELECT ${sql(input.valueColumn)} AS value, ${sql(labelColumn)} AS label
              FROM ${sql(input.table)}
              WHERE CAST(${sql(labelColumn)} AS TEXT) LIKE ${pattern}
                 OR CAST(${sql(input.valueColumn)} AS TEXT) LIKE ${pattern}
              ORDER BY ${sql(labelColumn)}
              LIMIT ${limit}
            `,
          );
        }

        return Effect.succeed(
          sql`
            SELECT ${sql(input.valueColumn)} AS value, ${sql(labelColumn)} AS label
            FROM ${sql(input.table)}
            ORDER BY ${sql(labelColumn)}
            LIMIT ${limit}
          `,
        );
      },
      orElse: () => Effect.die(new Error("Unsupported database dialect")),
    });

    const [compiledSql, params] = statement.compile();

    const rows = yield* statement.pipe(
      withQueryLogging({
        type: QueryLogType.TableRows,
        sql: compiledSql,
        params,
        level: QueryLogLevel.Info,
        connectionId,
        schema: input.schema || undefined,
        table: input.table,
        meta: { lookupFkValues: true },
      } as const),
    );

    return rows.map((row) => {
      const value = (row as { value: unknown }).value;
      const label = (row as { label: unknown }).label;
      return {
        value: value as FkLookupOption["value"],
        label: label == null ? String(value) : String(label),
      } satisfies FkLookupOption;
    });
  });
