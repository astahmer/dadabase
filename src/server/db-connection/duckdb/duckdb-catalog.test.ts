import type { SqlClient as SqlClientInterface } from "effect/unstable/sql/SqlClient";

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect, it } from "vitest";

import { layer as duckDbLayer } from "./duckdb-client.ts";

/**
 * §A.4 empirical verification: which catalog surfaces return stable metadata on
 * DuckDB. Findings are recorded in plans/csv-database-and-duckdb.md.
 */

const TestLayer = duckDbLayer({ url: ":memory:" });

const run = <A, E>(program: Effect.Effect<A, E, SqlClientInterface>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, TestLayer));

const setup = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.unsafe("DROP TABLE IF EXISTS orders");
  yield* sql.unsafe("DROP TABLE IF EXISTS customers");
  yield* sql.unsafe(`CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR DEFAULT 'anon'
  )`);
  yield* sql.unsafe(`CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT now()
  )`);
  yield* sql.unsafe("CREATE INDEX idx_orders_customer ON orders(customer_id)");
  return { sql };
});

describe("duckdb catalog surfaces (§A.4)", () => {
  it("information_schema basics: schemata/tables/columns", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;

        const schemas = yield* sql`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
          `;
        expect(schemas.map((s) => s.schema_name)).toContain("main");

        const tables = yield* sql`
            SELECT table_name as name, table_schema as schema FROM information_schema.tables
            WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `;
        expect(tables.map((t) => t.name).sort()).toEqual(["customers", "orders"]);

        const cols = yield* sql`
            SELECT column_name, data_type, is_nullable, column_default, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'main' AND table_name = 'customers'
            ORDER BY ordinal_position
          `;
        expect(cols[0]).toMatchObject({ column_name: "id", data_type: "INTEGER" });
        // DuckDB reports YES/NO strings like pg.
        expect(cols[0]?.is_nullable).toBe("NO");
        expect(cols[2]?.column_default).toBe("'anon'");
      }),
    );
  }, 20_000);

  it("constraints: information_schema.table_constraints vs duckdb_constraints()", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;

        const tc = yield* sql`
            SELECT constraint_name, constraint_type, table_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'main'
          `;
        expect(tc.length).toBeGreaterThan(0);

        const kcu = yield* sql`
            SELECT kcu.column_name, kcu.constraint_name, tc.constraint_type
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE kcu.table_schema = 'main' AND tc.constraint_type = 'PRIMARY KEY'
          `.pipe(Effect.catch(() => Effect.succeed([])));
        expect(kcu.length).toBeGreaterThanOrEqual(2);

        const duckConstraints = yield* sql`
            SELECT database_name, schema_name, table_name, constraint_type,
                   constraint_column_names, constraint_column_indexes
            FROM duckdb_constraints()
            WHERE schema_name = 'main'
          `;
        const pkCols = duckConstraints.filter((c) => c.constraint_type === "PRIMARY KEY");
        expect(pkCols.length).toBeGreaterThanOrEqual(2);
        void duckConstraints;
      }),
    );
  }, 20_000);

  it("foreign keys + indexes", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;

        // FKs via information_schema.referential_constraints may or may not exist;
        // duckdb_constraints carries FK info reliably.
        const fks = yield* sql`
            SELECT table_name, constraint_column_names AS columns,
                   constraint_text
            FROM duckdb_constraints()
            WHERE schema_name = 'main' AND constraint_type = 'FOREIGN KEY'
          `;
        expect(fks.length).toBe(1);
        expect(fks[0]).toMatchObject({ table_name: "orders" });

        const indexes = yield* sql`
            SELECT index_name, table_name, is_unique, expressions
            FROM duckdb_indexes()
            WHERE schema_name = 'main' AND table_name = 'orders'
          `;
        expect(indexes.length).toBeGreaterThanOrEqual(1);
      }),
    );
  }, 20_000);

  it("explain shape", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;
        const plan = yield* sql.unsafe("EXPLAIN SELECT * FROM customers");
        const rows = plan as Array<Record<string, unknown>>;
        expect(rows.length).toBeGreaterThan(0);
        expect(typeof rows[0]?.explain_value).toBe("string");
      }),
    );
  }, 20_000);

  it("rowid pseudo-column works for system row identity", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;
        yield* sql`INSERT INTO customers (id, email) VALUES (1, 'a@b.c')`;
        const rows = yield* sql`SELECT rowid AS rid, id FROM customers WHERE id = 1`;
        expect(Object.keys(rows[0] ?? {})).toEqual(["rid", "id"]);
        const byRowId = yield* sql`SELECT id FROM customers WHERE rowid = ${rows[0]?.rid}`;
        expect(byRowId[0]).toEqual({ id: 1 });
      }),
    );
  }, 20_000);

  it("type display mapping covers common duckdb types", async () => {
    await run(
      Effect.gen(function* () {
        const { sql } = yield* setup;
        const cols = yield* sql`
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'main' AND table_name = 'orders'
            ORDER BY ordinal_position
          `;
        const types = Object.fromEntries(cols.map((c) => [c.column_name, c.data_type]));
        expect(types.id).toBe("BIGINT");
        expect(types.total).toBe("DECIMAL(10,2)");
        // Plain TIMESTAMP (not timestamptz) reports without a timezone suffix.
        expect(types.created_at).toBe("TIMESTAMP");
      }),
    );
  }, 20_000);
});
