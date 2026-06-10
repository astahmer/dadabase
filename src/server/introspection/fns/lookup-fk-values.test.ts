import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import type { DatabaseTestConfig } from "../test.layer.ts";

import {
  libsqlLayer,
  makeTestLayer,
  pgliteLayer,
  postgresConfig,
  sqliteConfig,
} from "../test.layer.ts";
import { lookupFkValues } from "./lookup-fk-values.ts";

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

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
            INSERT INTO ${sql(config.defaultSchema)}.users (name, email) VALUES
            ('Alice', 'alice@example.com'),
            ('Bob', 'bob@example.com'),
            ('Charlie', 'charlie@example.com')
          `,
        sqlite: () =>
          sql`
            INSERT INTO users (name, email) VALUES
            ('Alice', 'alice@example.com'),
            ('Bob', 'bob@example.com'),
            ('Charlie', 'charlie@example.com')
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });
    });

    const testLayer = makeTestLayer(sqlLayer);
    const schema = config.isPostgres ? config.defaultSchema : "";

    it.effect("returns value/label options", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const options = yield* lookupFkValues(
          {
            schema,
            table: "users",
            valueColumn: "id",
            labelColumn: "name",
            limit: 10,
          },
          { id: "test" } as any,
        );

        expect(options.length).toBe(3);
        expect(options.map((o) => o.label).sort()).toEqual(["Alice", "Bob", "Charlie"]);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("filters by search term", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const options = yield* lookupFkValues(
          {
            schema,
            table: "users",
            valueColumn: "id",
            labelColumn: "name",
            search: "ali",
          },
          { id: "test" } as any,
        );

        expect(options.length).toBe(1);
        expect(options[0].label).toBe("Alice");
      }).pipe(Effect.provide(testLayer));
    });
  };
};

describe("lookupFkValues", () => {
  describe("PostgreSQL", testSuite(pgliteLayer, postgresConfig));
  describe("SQLite", testSuite(libsqlLayer, sqliteConfig));
});
