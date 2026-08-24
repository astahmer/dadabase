import type { SqlClient as SqlClientInterface } from "effect/unstable/sql/SqlClient";

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect, it } from "vitest";

import { layer as duckDbLayer, probeDuckDbPath } from "./duckdb-client.ts";

/**
 * Spike + contract tests for the DuckDB SqlClient shim.
 * See plans/csv-database-and-duckdb.md §A.1/A.2 — placeholder-syntax and
 * transaction findings are recorded here on purpose.
 *
 * All tests share one cached `:memory:` instance through the layer (validating
 * the driver-level instance cache); each test uses distinct table names so no
 * cross-test state leaks.
 */

const TestLayer = duckDbLayer({ url: ":memory:" });

const run = <A, E>(program: Effect.Effect<A, E, SqlClientInterface>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, TestLayer));

describe("duckdb-client", () => {
  it(
    "runs a plain select through the shim (unsafe surface)",
    () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql`SELECT 42 AS answer`;
          expect(rows).toHaveLength(1);
          expect(rows[0]).toEqual({ answer: 42 });
        }),
      ),
    20_000,
  );

  it(
    "accepts $n placeholders natively (no rewriting needed)",
    () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          // The template compiles to `SELECT $1 AS marker` via PgClient.makeCompiler.
          const rows = yield* sql`SELECT ${"pg-style"} AS marker`;
          expect(rows[0]).toEqual({ marker: "pg-style" });
        }),
      ),
    20_000,
  );

  it(
    "insert/update/delete round-trip with builder helpers",
    () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql.unsafe("DROP TABLE IF EXISTS t");
          yield* sql.unsafe(`CREATE TABLE t (
            id INTEGER PRIMARY KEY,
            name VARCHAR NOT NULL,
            score DOUBLE
          )`);

          yield* sql`INSERT INTO t ${sql.insert([
            { id: 1, name: "alpha", score: 1.5 },
            { id: 2, name: "beta", score: null },
          ])}`;

          const inserted = yield* sql`SELECT * FROM t ORDER BY id`;
          expect(inserted).toHaveLength(2);
          expect(inserted[0]).toEqual({ id: 1, name: "alpha", score: 1.5 });
          expect(inserted[1]?.score).toBeNull();

          yield* sql`UPDATE t SET ${sql.update({ score: 9 })} WHERE ${sql`id = ${2}`}`;
          const updated = yield* sql`SELECT score FROM t WHERE id = ${2}`;
          expect(updated[0]).toEqual({ score: 9 });

          const rawResult = yield* sql`DELETE FROM t WHERE id = ${1}`.raw;
          expect((rawResult as { rowCount?: number }).rowCount).toBe(1);
        }),
      ),
    20_000,
  );

  it(
    "transactions: BEGIN/COMMIT semantics hold on the shared connection",
    () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql.unsafe("DROP TABLE IF EXISTS tx_t");
          yield* sql.unsafe("CREATE TABLE tx_t (v INTEGER)");

          yield* sql.unsafe("BEGIN");
          yield* sql`INSERT INTO tx_t VALUES (${1})`;
          yield* sql.unsafe("ROLLBACK");

          const afterRollback = yield* sql`SELECT COUNT(*)::INT AS n FROM tx_t`;
          expect(afterRollback[0]).toEqual({ n: 0 });

          yield* sql.unsafe("BEGIN");
          yield* sql`INSERT INTO tx_t VALUES (${7})`;
          yield* sql.unsafe("COMMIT");

          const afterCommit = yield* sql`SELECT COUNT(*)::INT AS n FROM tx_t`;
          expect(afterCommit[0]).toEqual({ n: 1 });
        }),
      ),
    20_000,
  );

  it(
    "identifier quoting survives the pg compiler (double quotes)",
    () =>
      run(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql.unsafe('DROP TABLE IF EXISTS "order"');
          yield* sql.unsafe('CREATE TABLE "order" ("select" INTEGER)');
          yield* sql`INSERT INTO ${sql("order")} ${sql.insert([{ select: 5 }])}`;
          const rows = yield* sql`SELECT ${sql("select")} FROM ${sql("order")}`;
          expect(rows[0]).toEqual({ select: 5 });
        }),
      ),
    20_000,
  );

  it("probeDuckDbPath succeeds on :memory: and fails on unopenable paths", async () => {
    const ok = await Effect.runPromise(probeDuckDbPath(":memory:"));
    expect(ok.success).toBe(true);

    const bad = await Effect.runPromise(probeDuckDbPath("/definitely/not/a/real/dir/db.duckdb"));
    expect(bad.success).toBe(false);
    expect(bad.message.length).toBeGreaterThan(0);
  }, 20_000);
});
