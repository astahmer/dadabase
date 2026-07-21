import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { executeCustomSql } from "./introspection.ts";
import { PgContainer, isContainerRuntimeAvailable } from "./pg-test.layer.ts";
import { makeTestLayer, postgresConfig } from "./test.layer.ts";

const testSuite = (
  pgLayer: Layer.Layer<SqlClient.SqlClient>,
  config: { defaultSchema: string },
) => {
  return () => {
    const setupSchema = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.onDialectOrElse({
        pg: () =>
          sql`
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.comments CASCADE;
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.posts CASCADE;
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users CASCADE;
				`,
        sqlite: () =>
          sql`
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.comments;
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.posts;
					DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users;
				`,
        orElse: () => Effect.fail(new Error("Unsupported database")),
      });

      // Create users table
      yield* sql`
				CREATE TABLE ${sql(config.defaultSchema)}.users (
					id SERIAL PRIMARY KEY,
					name VARCHAR(255) NOT NULL,
					email VARCHAR(255) UNIQUE,
					age INT
				)
			`;

      // Create posts table
      yield* sql`
				CREATE TABLE ${sql(config.defaultSchema)}.posts (
					id SERIAL PRIMARY KEY,
					user_id INT REFERENCES ${sql(config.defaultSchema)}.users(id),
					title VARCHAR(255) NOT NULL,
					content TEXT,
					published BOOLEAN DEFAULT false
				)
			`;

      // Create comments table
      yield* sql`
				CREATE TABLE ${sql(config.defaultSchema)}.comments (
					id SERIAL PRIMARY KEY,
					post_id INT REFERENCES ${sql(config.defaultSchema)}.posts(id),
					user_id INT REFERENCES ${sql(config.defaultSchema)}.users(id),
					content TEXT NOT NULL
				)
			`;
    });

    const insertTestData = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Insert users
      yield* sql`
				INSERT INTO ${sql(config.defaultSchema)}.users (name, email, age)
				VALUES
					('Alice', 'alice@example.com', 28),
					('Bob', 'bob@example.com', 30),
					('Charlie', 'charlie@example.com', 32),
					('David', 'david@example.com', 35)
			`;

      // Insert posts
      yield* sql`
				INSERT INTO ${sql(config.defaultSchema)}.posts (user_id, title, content, published)
				VALUES
					(1, 'First Post', 'Content 1', true),
					(1, 'Second Post', 'Content 2', false),
					(2, 'Third Post', 'Content 3', true),
					(2, 'Fourth Post', 'Content 4', false)
			`;

      // Insert comments
      yield* sql`
				INSERT INTO ${sql(config.defaultSchema)}.comments (post_id, user_id, content)
				VALUES
					(1, 2, 'Great post!'),
					(1, 3, 'Thanks!'),
					(3, 1, 'Nice article!'),
					(4, 1, 'Keep it up!')
			`;
    });

    const testLayer = makeTestLayer(pgLayer);

    it.effect("executes custom SELECT query and returns rows", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `SELECT id, name, email, age FROM ${config.defaultSchema}.users WHERE age > 28`,
        });

        // Should return rows matching the WHERE clause
        expect(result.rows.length).toBe(3); // Ages 30, 32, 35
        expect(result.rowCount).toBe(3);
        // rowsAffected should not be set for SELECT queries
        expect(result.rowsAffected).toBeUndefined();
        // Should have the correct columns
        expect(result.columns).toEqual(["id", "name", "email", "age"]);
        // All results should have timing info
        expect(result.timeTaken).toBeGreaterThanOrEqual(0);
        expect(result.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("executes custom DELETE query and returns rowsAffected", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        // First, delete the comments that reference the posts
        yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.comments WHERE post_id IN (1, 2)`,
        });

        const result = yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.posts WHERE id IN (1, 2)`,
        });

        // DELETE queries return no rows
        expect(result.rows.length).toBe(0);
        expect(result.rowCount).toBe(0);
        expect(result.columns).toEqual([]);
        // rowsAffected is defined for DELETE queries
        expect(result.rowsAffected).toBeDefined();
        expect(result.rowsAffected).toBe(2);
        expect(result.timeTaken).toBeGreaterThanOrEqual(0);
        expect(result.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("executes custom DELETE query with no matches and returns 0 rowsAffected", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.users WHERE age > 100`,
        });

        // DELETE queries return no rows
        expect(result.rows.length).toBe(0);
        expect(result.rowCount).toBe(0);
        // rowsAffected should be 0 when no rows match
        expect(result.rowsAffected).toBe(0);
        expect(result.timeTaken).toBeGreaterThanOrEqual(0);
        expect(result.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("executes custom UPDATE query and returns rowsAffected", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `UPDATE ${config.defaultSchema}.users SET age = age + 1 WHERE age > 30`,
        });

        // UPDATE queries return no rows
        expect(result.rows.length).toBe(0);
        expect(result.rowCount).toBe(0);
        expect(result.columns).toEqual([]);
        // rowsAffected is set for UPDATE queries
        expect(result.rowsAffected).toBe(2);
        expect(result.timeTaken).toBeGreaterThanOrEqual(0);
        expect(result.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("executes custom INSERT query and returns rowsAffected", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `INSERT INTO ${config.defaultSchema}.users (name, email, age) VALUES ('NewUser', 'new@example.com', 40)`,
        });

        // INSERT queries return no rows
        expect(result.rows.length).toBe(0);
        expect(result.rowCount).toBe(0);
        // rowsAffected is set for INSERT queries
        expect(result.rowsAffected).toBe(1);
        expect(result.timeTaken).toBeGreaterThanOrEqual(0);
        expect(result.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("distinguishes between SELECT and non-SELECT custom queries", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        // SELECT query should have rows and no rowsAffected
        const selectResult = yield* executeCustomSql({
          sql: `SELECT * FROM ${config.defaultSchema}.users LIMIT 2`,
        });

        expect(selectResult.rows.length).toBeGreaterThan(0);
        expect(selectResult.rowCount).toBeGreaterThan(0);
        expect(selectResult.rowsAffected).toBeUndefined();
        expect(selectResult.timeTaken).toBeGreaterThanOrEqual(0);
        expect(selectResult.ranAt).toBeGreaterThan(0);

        // DELETE query should have no rows but have rowsAffected
        // First delete all comments to avoid FK constraints
        yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.comments`,
        });
        yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.posts WHERE user_id = 1`,
        });

        const deleteResult = yield* executeCustomSql({
          sql: `DELETE FROM ${config.defaultSchema}.users WHERE id = 1`,
        });

        expect(deleteResult.rows.length).toBe(0);
        expect(deleteResult.rowCount).toBe(0);
        expect(deleteResult.rowsAffected).toBe(1);
        expect(deleteResult.timeTaken).toBeGreaterThanOrEqual(0);
        expect(deleteResult.ranAt).toBeGreaterThan(0);
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("SELECT with multiple rows returns all columns", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `SELECT id, name, email FROM ${config.defaultSchema}.users ORDER BY id`,
        });

        expect(result.rows.length).toBe(4);
        expect(result.rowCount).toBe(4);
        expect(result.columns).toEqual(["id", "name", "email"]);
        // Verify column data is present
        const firstRow = result.rows[0] as Record<string, unknown>;
        expect(firstRow).toHaveProperty("id");
        expect(firstRow).toHaveProperty("name");
        expect(firstRow).toHaveProperty("email");
        expect(result.rowsAffected).toBeUndefined();
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("SELECT with WHERE clause filters correctly", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `SELECT * FROM ${config.defaultSchema}.posts WHERE published = true`,
        });

        expect(result.rows.length).toBe(2);
        expect(result.rowCount).toBe(2);
        expect(result.columns).toContain("id");
        expect(result.columns).toContain("title");
        expect(result.rowsAffected).toBeUndefined();
      }).pipe(Effect.provide(testLayer));
    });

    it.effect("handles empty result sets", () => {
      return Effect.gen(function* () {
        yield* setupSchema;
        yield* insertTestData;

        const result = yield* executeCustomSql({
          sql: `SELECT * FROM ${config.defaultSchema}.users WHERE age > 200`,
        });

        expect(result.rows.length).toBe(0);
        expect(result.rowCount).toBe(0);
        expect(result.columns).toEqual([]);
        expect(result.rowsAffected).toBeUndefined();
      }).pipe(Effect.provide(testLayer));
    });
  };
};

describe.skipIf(!isContainerRuntimeAvailable())(
  "executeCustomSql (pg with testcontainers)",
  testSuite(PgContainer.ClientLive.pipe(Layer.catchAll(Layer.die)), postgresConfig),
  1000 * 60 * 10,
);
