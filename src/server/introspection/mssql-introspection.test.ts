import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";
import {
  makeRemoteConnectionLayer,
  makeRemoteDialectLayer,
  RemoteConnectionId,
} from "#src/server/db-connection/remote-connection.tag.ts";
import { QueryLoggerNoopLayer } from "#src/server/query-logger/query-logger.layer.noop.ts";

import {
  getAvailableTables,
  getRelationshipCardinality,
  getTableColumns,
  getTableForeignKeys,
  getTableIndexes,
  getTableRelationships,
} from "./introspection.ts";
import { isContainerRuntimeAvailable, MssqlContainer } from "./mssql-test.layer.ts";

/**
 * End-to-end introspection against a real SQL Server container — mirrors the
 * duckdb/pglite per-dialect introspection tests. Skipped when Docker is absent
 * (and on arm64 hosts where the amd64-only image cannot run).
 */
describe.skipIf(!isContainerRuntimeAvailable())(
  "mssql introspection (e2e, real SQL Server container)",
  () => {
    const TestLayer = Layer.mergeAll(
      MssqlContainer.ClientLive,
      QueryLoggerNoopLayer,
      makeRemoteConnectionLayer(RemoteConnectionId.make("test-mssql-connection")),
      makeRemoteDialectLayer(DatabaseDialect.Mssql),
    );

    it("introspects tables, columns, FKs, indexes and relationships via sys.* views", async () => {
      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* sql.unsafe(`
						CREATE TABLE customers (
							id INT NOT NULL PRIMARY KEY,
							email VARCHAR(255) NOT NULL UNIQUE
						)
					`);
        yield* sql.unsafe(`
						CREATE TABLE orders (
							id INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
							customer_id INT NOT NULL REFERENCES customers(id),
							note VARCHAR(100) NULL DEFAULT 'none'
						)
					`);

        // -- tables ---------------------------------------------------------
        const tables = yield* getAvailableTables({ schema: "dbo" });
        const tableNames = tables.map((t) => t.name).sort();
        expect(tableNames).toContain("customers");
        expect(tableNames).toContain("orders");

        // -- columns --------------------------------------------------------
        const customerColumns = yield* getTableColumns({ schema: "dbo", table: "customers" });
        const byName = new Map(customerColumns.map((c) => [c.name, c]));
        expect(byName.get("id")?.primaryKey).toBe(true);
        expect(byName.get("id")?.dataType.toLowerCase()).toBe("int");
        expect(byName.get("id")?.nullable).toBe(false);
        expect(byName.get("email")?.unique).toBe(true);
        expect(byName.get("email")?.nullable).toBe(false);

        const orderColumns = yield* getTableColumns({ schema: "dbo", table: "orders" });
        const orderCols = new Map(orderColumns.map((c) => [c.name, c]));
        expect(orderCols.get("customer_id")?.isForeignKey).toBe(true);
        expect(orderCols.get("customer_id")?.foreignKey?.referencedTable).toBe("customers");
        expect(orderCols.get("customer_id")?.foreignKey?.referencedColumn).toBe("id");
        expect(orderCols.get("note")?.defaultValue).toBe("'none'");

        // -- foreign keys ---------------------------------------------------
        const fks = yield* getTableForeignKeys({ schema: "dbo", table: "orders" });
        expect(fks).toHaveLength(1);
        expect(fks[0]?.column_name).toBe("customer_id");
        expect(fks[0]?.referenced_table_schema).toBe("dbo");
        expect(fks[0]?.referenced_table_name).toBe("customers");
        expect(fks[0]?.referenced_column_name).toBe("id");
        expect(fks[0]?.delete_rule).toBe("NO ACTION");

        // -- indexes --------------------------------------------------------
        const customerIndexes = yield* getTableIndexes({ schema: "dbo", table: "customers" });
        const pkIndex = customerIndexes.find((idx) => idx.is_primary);
        expect(pkIndex?.column_name).toBe("id");
        const emailUnique = customerIndexes.find(
          (idx) => idx.column_name === "email" && idx.is_unique && !idx.is_primary,
        );
        expect(emailUnique).toBeDefined();

        // -- relationships (incoming FK from orders) -------------------------
        const relationships = yield* getTableRelationships({ schema: "dbo", table: "customers" });
        const incoming = relationships.filter((rel) => rel.type === "incoming");
        expect(incoming.length).toBeGreaterThan(0);
        expect(incoming[0]?.referencingTable).toBe("orders");
        expect(incoming[0]?.referencingColumn).toBe("customer_id");

        // -- cardinality: plain FK + PK ref => many-to-one -------------------
        const cardinality = yield* getRelationshipCardinality({
          schema: "dbo",
          table: "orders",
          columns: ["customer_id"],
          isIncomingRelationship: false,
        });
        expect(cardinality).toBe("many-to-one");

        return true;
      });

      await Effect.runPromise(Effect.provide(program, TestLayer) as Effect.Effect<boolean>);
    }, 120_000);
  },
);
