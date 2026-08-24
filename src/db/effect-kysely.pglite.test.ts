// import { vector } from "@electric-sql/pglite/vector";
import { Context, Effect, Layer } from "effect";
import { type ColumnType, sql } from "kysely";
import { describe, expect, test } from "vitest";

import type { EffectKysely } from "./effect-kysely.ts";

import { makeEffectKyselyPglite } from "./effect-kysely.pglite.ts";

class InMemoryPgliteDb extends Context.Service<
  InMemoryPgliteDb,
  EffectKysely<TestInMemoryDbSchema>
>()("@dadabase/InMemoryPgliteDb") {}

interface TestInMemoryDbSchema {
  test_table: {
    id: ColumnType<number, number, number>;
    name: ColumnType<string, string, string>;
  };
  test_table_delete: {
    id: ColumnType<number, number, number>;
    name: ColumnType<string, string, string>;
  };
}

const InMemoryLayer = Layer.effect(
  InMemoryPgliteDb,
  makeEffectKyselyPglite<TestInMemoryDbSchema>({
    dataDir: "memory://",
    // extensions: { vector },
  }),
);

describe("PGlite integration test", () => {
  test("should create in-memory database and execute basic query", async () => {
    const program = Effect.gen(function* () {
      const db = yield* InMemoryPgliteDb;

      // Test basic SQL execution
      yield* db.executeRaw(sql`SELECT 1 as test`);

      return "success";
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(InMemoryLayer)));

    expect(result).toBe("success");
  });

  test("should create tables and insert data", async () => {
    const program = Effect.gen(function* () {
      const db = yield* InMemoryPgliteDb;

      // Create a simple test table
      yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS test_table (
					id SERIAL PRIMARY KEY,
					name TEXT NOT NULL
				)
			`);

      // Insert some data
      yield* db.executeRaw(sql`
				INSERT INTO test_table (name) VALUES ('test1'), ('test2')
			`);

      // Query the data back
      const result = yield* db.execute(db.selectFrom("test_table").selectAll());

      return result;
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(InMemoryLayer)));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, name: "test1" });
    expect(result[1]).toMatchObject({ id: 2, name: "test2" });
  });

  test("should delete rows from table", async () => {
    const program = Effect.gen(function* () {
      const db = yield* InMemoryPgliteDb;

      // Create a simple test table
      yield* db.executeRaw(sql`
				CREATE TABLE IF NOT EXISTS test_table_delete (
					id SERIAL PRIMARY KEY,
					name TEXT NOT NULL
				)
			`);

      // Insert some data
      yield* db.executeRaw(sql`
				INSERT INTO test_table_delete (name) VALUES ('test1'), ('test2'), ('test3')
			`);

      // Verify initial insert
      const beforeDelete = yield* db.execute(db.selectFrom("test_table_delete").selectAll());
      expect(beforeDelete).toHaveLength(3);

      // Delete a specific row
      yield* db.execute(db.deleteFrom("test_table_delete").where("id", "=", 2));

      // Query the data after deletion
      const afterDelete = yield* db.execute(db.selectFrom("test_table_delete").selectAll());

      return { beforeDelete, afterDelete };
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(InMemoryLayer)));

    expect(result.beforeDelete).toHaveLength(3);
    expect(result.afterDelete).toHaveLength(2);
    expect(result.afterDelete[0]).toMatchObject({ id: 1, name: "test1" });
    expect(result.afterDelete[1]).toMatchObject({ id: 3, name: "test3" });
  });
});
