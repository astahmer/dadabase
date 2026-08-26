import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { DatabaseTestConfig } from "../test.layer.ts";

import {
  libsqlLayer,
  makeTestLayer,
  pgliteLayer,
  postgresConfig,
  sqliteConfig,
} from "../test.layer.ts";
import { insertRow } from "./insert-row.ts";

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
              email TEXT NOT NULL UNIQUE,
              age INTEGER,
              active BOOLEAN DEFAULT true
            )
          `,
        sqlite: () =>
          sql`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              age INTEGER,
              active INTEGER DEFAULT 1
            )
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });
    });

    const testLayer = makeTestLayer(sqlLayer);
    const schema = config.isPostgres ? config.defaultSchema : "";

    it.effect("inserts a row and returns rowsAffected", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* insertRow(
          {
            schema,
            table: "users",
            values: {
              name: "Alice",
              email: "alice@example.com",
              age: 30,
            },
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBeGreaterThanOrEqual(1);

        const sql = yield* SqlClient.SqlClient;
        const users = yield* sql.onDialectOrElse({
          pg: () =>
            sql`SELECT name, email, age FROM ${sql(config.defaultSchema)}.users WHERE email = ${"alice@example.com"}`,
          sqlite: () =>
            sql`SELECT name, email, age FROM users WHERE email = ${"alice@example.com"}`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });

        expect(users.length).toBe(1);
        expect(users[0]).toMatchObject({
          name: "Alice",
          email: "alice@example.com",
          age: 30,
        });
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("fails when values are empty", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* insertRow(
          {
            schema,
            table: "users",
            values: {},
          },
          { id: "test" } as any,
        ).pipe(Effect.result);

        expect(result._tag).toBe("Failure");
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("inserts null for nullable columns", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        yield* insertRow(
          {
            schema,
            table: "users",
            values: {
              name: "Bob",
              email: "bob@example.com",
              age: null,
            },
          },
          { id: "test" } as any,
        );

        const sql = yield* SqlClient.SqlClient;
        const users = yield* sql.onDialectOrElse({
          pg: () =>
            sql`SELECT age FROM ${sql(config.defaultSchema)}.users WHERE email = ${"bob@example.com"}`,
          sqlite: () => sql`SELECT age FROM users WHERE email = ${"bob@example.com"}`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });

        expect(users[0].age).toBeNull();
      }).pipe(Effect.provide(testLayer));
    });
  };
};

describe("insertRow", () => {
  describe("PostgreSQL", testSuite(pgliteLayer, postgresConfig));
  describe("SQLite", testSuite(libsqlLayer, sqliteConfig));
});
