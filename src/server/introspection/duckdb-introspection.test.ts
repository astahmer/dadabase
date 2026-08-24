import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { layer as duckDbLayer } from "#src/server/db-connection/duckdb/duckdb-client.ts";
import {
  makeRemoteConnectionLayer,
  makeRemoteDialectLayer,
  RemoteConnectionId,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLoggerNoopLayer } from "#src/server/query-logger/query-logger.layer.noop.ts";

import {
  getAvailableDatabases,
  getAvailableTables,
  getTableColumns,
  getTableForeignKeys,
  getTableRelationships,
} from "./introspection.ts";

/**
 * End-to-end introspection against a real temporary .duckdb file — mirrors the
 * per-dialect introspection test pairs (pglite / libsql layers).
 */

const makeEnv = () => {
  const filePath = join(mkdtempSync("/tmp/dadabase-duckdb-"), `${randomUUID()}.duckdb`);
  return filePath;
};

describe("duckdb introspection (e2e, real .duckdb file)", () => {
  it("introspects tables, columns, FKs and relationships through the shim", async () => {
    const dbPath = makeEnv();
    const TestLayer = Layer.mergeAll(
      duckDbLayer({ url: dbPath }),
      QueryLoggerNoopLayer,
      makeRemoteConnectionLayer(RemoteConnectionId.make("test-connection")),
      makeRemoteDialectLayer(DatabaseDialect.DuckDB),
    );

    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql.unsafe(
        `CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            email VARCHAR UNIQUE NOT NULL
          )`,
      );
      yield* sql.unsafe(
        `CREATE TABLE orders (
            id BIGINT PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            note VARCHAR DEFAULT 'none'
          )`,
      );
      yield* sql`INSERT INTO customers ${sql.insert([{ id: 1, email: "a@b.c" }])}`;
      yield* sql`INSERT INTO orders ${sql.insert([{ id: 100, customer_id: 1, note: null }])}`;

      // Databases
      const databases = yield* getAvailableDatabases();
      expect(databases.length).toBeGreaterThanOrEqual(1);

      // Tables in main schema
      const tables = yield* getAvailableTables({ schema: "main" });
      expect(tables.map((t) => t.name).sort()).toEqual(["customers", "orders"]);

      // Columns incl. PK / FK metadata
      const columns = yield* getTableColumns({ schema: "main", table: "orders" });
      const byName = Object.fromEntries(columns.map((c) => [c.name, c]));
      expect(byName.id?.primaryKey).toBe(true);
      expect(byName.customer_id?.isForeignKey).toBe(true);
      expect(byName.customer_id?.foreignKey?.referencedTable).toBe("customers");
      expect(byName.customer_id?.foreignKey?.referencedColumn).toBe("id");
      expect(byName.note?.defaultValue).toBe("'none'");

      // Foreign keys
      const fks = yield* getTableForeignKeys({ schema: "main", table: "orders" });
      expect(fks).toHaveLength(1);
      expect(fks[0]).toMatchObject({
        column_name: "customer_id",
        referenced_table_name: "customers",
        referenced_column_name: "id",
      });

      // Relationships: outgoing from orders, incoming to customers
      const orderRels = yield* getTableRelationships({ schema: "main", table: "orders" });
      expect(
        orderRels.some((r) => r.type === "outgoing" && r.referencedTable === "customers"),
      ).toBe(true);

      const customerRels = yield* getTableRelationships({ schema: "main", table: "customers" });
      const incoming = customerRels.find((r) => r.type === "incoming");
      expect(incoming).toMatchObject({
        referencingTable: "orders",
        referencingColumn: "customer_id",
      });
    });

    try {
      await Effect.runPromise(Effect.provide(program, TestLayer));
    } finally {
      // Instances are process-cached; nothing to unlink safely while open on
      // all platforms — the temp directory is cleaned by the OS.
      void dbPath;
    }
  }, 30_000);
});
