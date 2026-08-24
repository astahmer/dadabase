import { Effect, Layer } from "effect";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { layer as csvLayer } from "#src/server/db-connection/duckdb/csv-client.ts";
import {
  makeRemoteConnectionLayer,
  makeRemoteDialectLayer,
  RemoteConnectionId,
  RemoteDialect,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLoggerNoopLayer } from "#src/server/query-logger/query-logger.layer.noop.ts";

import { getAvailableTables, getTableColumns, queryTableRows } from "./introspection.ts";

/** CSV connections must serve the standard introspection + row-paging surface. */
describe("csv introspection (real temp csv dir)", () => {
  it("lists tables, columns and rows through the in-memory engine", async () => {
    const dir = mkdtempSync("/tmp/dadabase-csv-introspection-");
    writeFileSync(join(dir, "people.csv"), "id,name\n1,Alice\n2,Bob\n3,Carol\n");

    const TestLayer = Layer.mergeAll(
      csvLayer(dir),
      QueryLoggerNoopLayer,
      makeRemoteConnectionLayer(RemoteConnectionId.make("test-connection")),
      makeRemoteDialectLayer(DatabaseDialect.Csv),
    );

    const program = Effect.gen(function* () {
      const dialectOpt = yield* Effect.serviceOption(RemoteDialect);
      console.log("LOG dialect option", dialectOpt);
      const tables = yield* getAvailableTables({ schema: "main" });
      console.log(
        "LOG tables",
        tables.map((t) => t.name),
      );

      const columns = yield* getTableColumns({ schema: "main", table: "people" });
      console.log("LOG columns", columns.length);

      const rows = yield* queryTableRows({
        schema: "main",
        table: "people",
        limit: 2,
        offset: 0,
        orderBy: undefined,
        filters: undefined,
      });
      console.log("LOG rows", rows.rows.length);
      expect(rows.rows.length).toBe(2);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  }, 30_000);
});
