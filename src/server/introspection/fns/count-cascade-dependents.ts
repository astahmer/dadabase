import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

import { assertSafeIdentifier, assertSafeIdentifiers } from "./row-mutation-utils.ts";

export type CascadeCountWalkEdge = {
  /** Parent table whose rows live in parentRowsByTable. */
  viaTable: string;
  childTable: string;
  /** Child FK columns (fromCols). */
  childColumns: readonly string[];
  /** Parent key columns on viaTable (toCols). */
  parentColumns: readonly string[];
  /** Whether matching child rows should seed parentRows for deeper hops. */
  seedChildren: boolean;
  /**
   * Extra columns to SELECT when seeding children (union of toCols for edges
   * that use this child as viaTable). Always includes childColumns when seeding.
   */
  seedColumns?: readonly string[];
};

/**
 * Count dependent rows for cascade preview — supports composite FKs and transitive hops.
 *
 * Walks `edges` in caller-provided depth order. `parentRowsByTable` starts with the root
 * selected rows; cascade edges seed child row key maps for the next hop.
 */
export const countCascadeDependentsWalk = (input: {
  schema: string;
  rootTable: string;
  rootRows: ReadonlyArray<Record<string, unknown>>;
  edges: readonly CascadeCountWalkEdge[];
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    if (input.schema) assertSafeIdentifier(input.schema, "schema");
    assertSafeIdentifier(input.rootTable, "table");

    const parentRowsByTable = new Map<string, ReadonlyArray<Record<string, unknown>>>();
    parentRowsByTable.set(input.rootTable, input.rootRows);

    const counts: Record<string, number | null> = {};

    for (const edge of input.edges) {
      assertSafeIdentifier(edge.childTable, "table");
      assertSafeIdentifier(edge.viaTable, "table");
      assertSafeIdentifiers([...edge.childColumns, ...edge.parentColumns], "column");
      if (
        edge.childColumns.length === 0 ||
        edge.childColumns.length !== edge.parentColumns.length
      ) {
        counts[edge.childTable] = null;
        continue;
      }

      const parents = parentRowsByTable.get(edge.viaTable) ?? [];
      if (parents.length === 0) {
        counts[edge.childTable] = 0;
        continue;
      }

      const tableRef = input.schema
        ? sql`${sql(input.schema)}.${sql(edge.childTable)}`
        : sql`${sql(edge.childTable)}`;

      const tuplePredicates = parents.map((parent) =>
        sql.and(
          edge.childColumns.map((childCol, i) => {
            const parentCol = edge.parentColumns[i]!;
            return sql`${sql(childCol)} = ${parent[parentCol]}`;
          }),
        ),
      );
      let where = tuplePredicates[0]!;
      for (let i = 1; i < tuplePredicates.length; i++) {
        where = sql`${where} OR ${tuplePredicates[i]!}`;
      }

      const countQuery = sql<{ count: number }>`
				SELECT COUNT(*) as count
				FROM ${tableRef}
				WHERE ${where}
			`;
      const countCompiled = countQuery.compile();
      const countRows = yield* countQuery.pipe(
        withQueryLogging({
          type: QueryLogType.RelationshipCounting,
          sql: countCompiled[0],
          params: countCompiled[1],
          schema: input.schema || undefined,
          table: edge.childTable,
          level: QueryLogLevel.Trace,
          connectionId,
          meta: { cascadeDependentCount: true },
        }),
        Effect.catchAll(() => Effect.succeed([{ count: -1 }])),
      );
      const n = Number(countRows[0]?.count ?? 0);
      counts[edge.childTable] = n < 0 ? null : n;

      if (edge.seedChildren && n > 0) {
        const seedCols = Array.from(new Set([...(edge.seedColumns ?? []), ...edge.childColumns]));
        assertSafeIdentifiers(seedCols, "column");
        const selectList = seedCols.map((c) => sql(c));
        let selectFrag = sql`${selectList[0]!}`;
        for (let i = 1; i < selectList.length; i++) {
          selectFrag = sql`${selectFrag}, ${selectList[i]!}`;
        }
        const seedQuery = sql<Record<string, unknown>>`
					SELECT ${selectFrag}
					FROM ${tableRef}
					WHERE ${where}
				`;
        const seedCompiled = seedQuery.compile();
        const seedRows = yield* seedQuery.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipCounting,
            sql: seedCompiled[0],
            params: seedCompiled[1],
            schema: input.schema || undefined,
            table: edge.childTable,
            level: QueryLogLevel.Trace,
            connectionId,
            meta: { cascadeDependentSeed: true },
          }),
          Effect.catchAll(() => Effect.succeed([] as Record<string, unknown>[])),
        );
        parentRowsByTable.set(edge.childTable, seedRows);
      }
    }

    return counts;
  });
