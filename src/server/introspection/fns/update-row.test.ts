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
import { updateRow } from "./update-row.ts";

const testSuite = (sqlLayer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => {
  return () => {
    const setupSchema = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql.onDialectOrElse({
        pg: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.memberships CASCADE`;
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users CASCADE`;
          }),
        sqlite: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS memberships`;
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
              age INTEGER NOT NULL
            )
          `,
        sqlite: () =>
          sql`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              age INTEGER NOT NULL
            )
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
            CREATE TABLE ${sql(config.defaultSchema)}.memberships (
              org_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL,
              PRIMARY KEY (org_id, user_id)
            )
          `,
        sqlite: () =>
          sql`
            CREATE TABLE memberships (
              org_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL,
              PRIMARY KEY (org_id, user_id)
            )
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
            INSERT INTO ${sql(config.defaultSchema)}.users (name, email, age) VALUES
            ('Alice', 'alice@example.com', 30),
            ('Bob', 'bob@example.com', 25)
          `,
        sqlite: () =>
          sql`
            INSERT INTO users (name, email, age) VALUES
            ('Alice', 'alice@example.com', 30),
            ('Bob', 'bob@example.com', 25)
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
            INSERT INTO ${sql(config.defaultSchema)}.memberships (org_id, user_id, role) VALUES
            (1, 1, 'admin'),
            (1, 2, 'member')
          `,
        sqlite: () =>
          sql`
            INSERT INTO memberships (org_id, user_id, role) VALUES
            (1, 1, 'admin'),
            (1, 2, 'member')
          `,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });
    });

    const testLayer = makeTestLayer(sqlLayer);
    const schema = config.isPostgres ? config.defaultSchema : "";

    it.effect("updates a row by primary key", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* updateRow(
          {
            schema,
            table: "users",
            primaryKey: { id: 1 },
            values: { name: "Alicia", age: 31 },
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(1);

        const sql = yield* SqlClient.SqlClient;
        const users = yield* sql.onDialectOrElse({
          pg: () => sql`SELECT name, age FROM ${sql(config.defaultSchema)}.users WHERE id = ${1}`,
          sqlite: () => sql`SELECT name, age FROM users WHERE id = ${1}`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });

        expect(users[0]).toMatchObject({ name: "Alicia", age: 31 });
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("updates a row with composite primary key", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* updateRow(
          {
            schema,
            table: "memberships",
            primaryKey: { org_id: 1, user_id: 2 },
            values: { role: "owner" },
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(1);

        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql.onDialectOrElse({
          pg: () =>
            sql`SELECT role FROM ${sql(config.defaultSchema)}.memberships WHERE org_id = ${1} AND user_id = ${2}`,
          sqlite: () => sql`SELECT role FROM memberships WHERE org_id = ${1} AND user_id = ${2}`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });

        expect(rows[0].role).toBe("owner");
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("fails without primary key", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* updateRow(
          {
            schema,
            table: "users",
            primaryKey: {},
            values: { name: "Nope" },
          },
          { id: "test" } as any,
        ).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("returns 0 rowsAffected for empty values", () => {
      return Effect.gen(function* () {
        yield* setupSchema;

        const result = yield* updateRow(
          {
            schema,
            table: "users",
            primaryKey: { id: 1 },
            values: {},
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(0);
      }).pipe(Effect.provide(testLayer));
    });
  };
};

describe("updateRow", () => {
  describe("PostgreSQL", testSuite(pgliteLayer, postgresConfig));
  describe("SQLite", testSuite(libsqlLayer, sqliteConfig));
});
