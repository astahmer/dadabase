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
import { bulkDeleteRows } from "./bulk-delete-rows.ts";

const testSuite = (sqlLayer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => {
  return () => {
    const setupSchema = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql.onDialectOrElse({
        pg: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.memberships CASCADE`;
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.posts CASCADE`;
            yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users CASCADE`;
          }),
        sqlite: () =>
          Effect.gen(function* () {
            yield* sql`DROP TABLE IF EXISTS memberships`;
            yield* sql`DROP TABLE IF EXISTS posts`;
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
						CREATE TABLE ${sql(config.defaultSchema)}.posts (
							id SERIAL PRIMARY KEY,
							user_id INTEGER REFERENCES ${sql(config.defaultSchema)}.users(id) ON DELETE CASCADE,
							title TEXT NOT NULL,
							content TEXT
						)
					`,
        sqlite: () =>
          sql`
						CREATE TABLE posts (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
							title TEXT NOT NULL,
							content TEXT
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
    });

    const insertTestData = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
						INSERT INTO ${sql(config.defaultSchema)}.users (name, email, age) VALUES
						('Alice', 'alice@example.com', 30),
						('Bob', 'bob@example.com', 25),
						('Charlie', 'charlie@example.com', 35),
						('Diana', 'diana@example.com', 28),
						('Eve', 'eve@example.com', 32)
					`,
        sqlite: () =>
          sql`
						INSERT INTO users (name, email, age) VALUES
						('Alice', 'alice@example.com', 30),
						('Bob', 'bob@example.com', 25),
						('Charlie', 'charlie@example.com', 35),
						('Diana', 'diana@example.com', 28),
						('Eve', 'eve@example.com', 32)
					`,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
						INSERT INTO ${sql(config.defaultSchema)}.posts (user_id, title, content) VALUES
						(1, 'Alice Post 1', 'Content 1'),
						(1, 'Alice Post 2', 'Content 2'),
						(2, 'Bob Post', 'Content 3'),
						(3, 'Charlie Post', 'Content 4')
					`,
        sqlite: () =>
          sql`
						INSERT INTO posts (user_id, title, content) VALUES
						(1, 'Alice Post 1', 'Content 1'),
						(1, 'Alice Post 2', 'Content 2'),
						(2, 'Bob Post', 'Content 3'),
						(3, 'Charlie Post', 'Content 4')
					`,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
						INSERT INTO ${sql(config.defaultSchema)}.memberships (org_id, user_id, role) VALUES
						(1, 1, 'admin'),
						(1, 2, 'member'),
						(2, 1, 'viewer')
					`,
        sqlite: () =>
          sql`
						INSERT INTO memberships (org_id, user_id, role) VALUES
						(1, 1, 'admin'),
						(1, 2, 'member'),
						(2, 1, 'viewer')
					`,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });
    });

    const testLayer = makeTestLayer(sqlLayer);
    const schema = () => (config.isPostgres ? config.defaultSchema : "");

    it.effect("deletes multiple rows by their numeric IDs", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* bulkDeleteRows(
          {
            schema: schema(),
            table: "users",
            primaryKeys: [{ id: 1 }, { id: 2 }],
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(2);

        const remainingUsers = yield* SqlClient.SqlClient;
        const users =
          yield* remainingUsers`SELECT id FROM ${remainingUsers(schema() || "main")}.users ORDER BY id`;
        expect(users.length).toBe(3);
        expect(users.map((u) => u.id)).toEqual([3, 4, 5]);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("deletes rows with composite primary keys", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* bulkDeleteRows(
          {
            schema: schema(),
            table: "memberships",
            primaryKeys: [
              { org_id: 1, user_id: 1 },
              { org_id: 1, user_id: 2 },
            ],
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(2);

        const sql = yield* SqlClient.SqlClient;
        const remaining = yield* sql.onDialectOrElse({
          pg: () =>
            sql`SELECT org_id, user_id FROM ${sql(config.defaultSchema)}.memberships ORDER BY org_id, user_id`,
          sqlite: () => sql`SELECT org_id, user_id FROM memberships ORDER BY org_id, user_id`,
          orElse: () => Effect.fail(new Error("Unsupported database")),
        });
        expect(remaining.length).toBe(1);
        expect(remaining[0]).toMatchObject({ org_id: 2, user_id: 1 });
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("returns rowsAffected: 0 when given empty array", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* bulkDeleteRows(
          {
            schema: schema(),
            table: "users",
            primaryKeys: [],
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("deletes single row", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* bulkDeleteRows(
          {
            schema: schema(),
            table: "users",
            primaryKeys: [{ id: 1 }],
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(1);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("handles deleting non-existent IDs gracefully", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* bulkDeleteRows(
          {
            schema: schema(),
            table: "users",
            primaryKeys: [{ id: 999 }, { id: 1000 }],
          },
          { id: "test" } as any,
        );

        expect(result.rowsAffected).toBe(0);
      }).pipe(Effect.provide(testLayer));
    });
  };
};

describe("bulkDeleteRows", () => {
  describe("PostgreSQL", testSuite(pgliteLayer, postgresConfig));
  describe("SQLite", testSuite(libsqlLayer, sqliteConfig));
});
