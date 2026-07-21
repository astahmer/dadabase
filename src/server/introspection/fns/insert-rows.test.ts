import { SqlClient } from "@effect/sql";
import { LibsqlClient } from "@effect/sql-libsql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DatabaseTestConfig } from "../test.layer.ts";

import { makeTestLayer, pgliteLayer, postgresConfig, sqliteConfig } from "../test.layer.ts";
import { insertRows } from "./insert-rows.ts";

/**
 * File-backed SQLite so `withTransaction` (reserved connection) shares schema
 * with the default connection. Plain `:memory:` is per-connection.
 */
const libsqlFileLayer = LibsqlClient.layer({
  url: `file:${join(mkdtempSync(join(tmpdir(), "insert-rows-")), "db.sqlite")}`,
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

const testSuite = (sqlLayer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => {
  return () => {
    const setupSchema = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql.onDialectOrElse({
        pg: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users CASCADE`;
          }),
        sqlite: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS users`;
          }),
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
            CREATE TABLE ${sql(config.defaultSchema)}.users (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE
            )
          `,
        sqlite: () =>
          sql`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE
            )
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });
    });

    const testLayer = makeTestLayer(sqlLayer);
    const schema = config.isPostgres ? config.defaultSchema : "";

    it.effect("inserts multiple rows in one transaction", () =>
      Effect.gen(function* () {
        yield* setupSchema;
        const result = yield* insertRows(
          {
            schema,
            table: "users",
            rows: [
              { name: "A", email: "a@example.com" },
              { name: "B", email: "b@example.com" },
            ],
          },
          { id: "test" } as never,
        );
        expect(result.inserted).toBe(2);

        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql.onDialectOrElse({
          pg: () => sql<{ count: number }>`SELECT COUNT(*) as count FROM ${sql(schema)}.users`,
          sqlite: () => sql<{ count: number }>`SELECT COUNT(*) as count FROM users`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });
        expect(Number(rows[0]?.count)).toBe(2);
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("rolls back the whole batch when a later row fails", () =>
      Effect.gen(function* () {
        yield* setupSchema;
        const sql = yield* SqlClient.SqlClient;
        yield* sql.onDialectOrElse({
          pg: () =>
            sql`INSERT INTO ${sql(schema)}.users (name, email) VALUES ('Existing', 'dup@example.com')`,
          sqlite: () => sql`INSERT INTO users (name, email) VALUES ('Existing', 'dup@example.com')`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });

        const failed = yield* insertRows(
          {
            schema,
            table: "users",
            rows: [
              { name: "New", email: "new@example.com" },
              { name: "Clash", email: "dup@example.com" },
            ],
          },
          { id: "test" } as never,
        ).pipe(Effect.either);

        expect(failed._tag).toBe("Left");

        const rows = yield* sql.onDialectOrElse({
          pg: () => sql<{ count: number }>`SELECT COUNT(*) as count FROM ${sql(schema)}.users`,
          sqlite: () => sql<{ count: number }>`SELECT COUNT(*) as count FROM users`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });
        // Only the pre-existing row — the successful first insert of the batch rolled back.
        expect(Number(rows[0]?.count)).toBe(1);
      }).pipe(Effect.provide(testLayer)),
    );
  };
};

describe("insertRows (pglite)", testSuite(pgliteLayer, postgresConfig));
describe("insertRows (libsql file)", testSuite(libsqlFileLayer, sqliteConfig));
