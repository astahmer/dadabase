import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import { assertSafeIdentifier } from "./row-mutation-utils.ts";

export interface CountCascadeDependentEdgeInput {
  childTable: string;
  childColumn: string;
  /** Parent key values selected for deletion (matched against `childColumn`). */
  parentValues: readonly unknown[];
}

/**
 * Cheap COUNT(*) for direct child tables referencing selected parent key values.
 * Multi-column FKs and transitive hops are out of scope — callers should skip those.
 */
export const countCascadeDependents = (input: {
  schema: string;
  edges: readonly CountCascadeDependentEdgeInput[];
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    if (input.schema) assertSafeIdentifier(input.schema, "schema");
    const counts: Record<string, number | null> = {};

    for (const edge of input.edges) {
      assertSafeIdentifier(edge.childTable, "table");
      assertSafeIdentifier(edge.childColumn, "column");
      if (edge.parentValues.length === 0) {
        counts[edge.childTable] = 0;
        continue;
      }

      const tableRef = input.schema
        ? sql`${sql(input.schema)}.${sql(edge.childTable)}`
        : sql`${sql(edge.childTable)}`;
      const column = sql(edge.childColumn);
      // Parameterized IN list via Effect SQL array expansion is dialect-sensitive;
      // fall back to OR of equality for portability across pg/sqlite/mysql.
      const predicates = edge.parentValues.map((value) => sql`${column} = ${value}`);
      let where = predicates[0]!;
      for (let i = 1; i < predicates.length; i++) {
        where = sql`${where} OR ${predicates[i]!}`;
      }

      const query = sql<{ count: number }>`
				SELECT COUNT(*) as count
				FROM ${tableRef}
				WHERE ${where}
			`;
      const compiled = query.compile();
      const rows = yield* query.pipe(
        withQueryLogging({
          type: QueryLogType.RelationshipCounting,
          sql: compiled[0],
          params: compiled[1],
          schema: input.schema || undefined,
          table: edge.childTable,
          level: QueryLogLevel.Trace,
          connectionId,
          meta: { cascadeDependentCount: true },
        }),
        Effect.catchAll(() => Effect.succeed([{ count: -1 }])),
      );
      const n = Number(rows[0]?.count ?? 0);
      counts[edge.childTable] = n < 0 ? null : n;
    }

    return counts;
  });
