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

const testSuite = (
	sqlLayer: Layer.Layer<SqlClient.SqlClient>,
	config: DatabaseTestConfig,
) => {
	return () => {
		const setupSchema = Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			yield* sql.onDialectOrElse({
				pg: () =>
					Effect.gen(function* () {
						yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.posts CASCADE`;
						yield* sql`DROP TABLE IF EXISTS ${sql(config.defaultSchema)}.users CASCADE`;
					}),
				sqlite: () =>
					Effect.gen(function* () {
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
		});

		const testLayer = makeTestLayer(sqlLayer);

		it.effect("deletes multiple rows by their numeric IDs", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const schema = config.isPostgres ? config.defaultSchema : "";

				const result = yield* bulkDeleteRows(
					{
						schema,
						table: "users",
						primaryKeyColumn: "id",
						ids: [1, 2],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(2);

				const remainingUsers = yield* SqlClient.SqlClient;
				const users =
					yield* remainingUsers`SELECT id FROM ${remainingUsers(schema || "main")}.users ORDER BY id`;
				expect(users.length).toBe(3);
				const remainingIds = users.map((u) => u.id);
				expect(remainingIds).toEqual([3, 4, 5]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("deletes rows from table with foreign key constraints", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* bulkDeleteRows(
					{
						schema: config.defaultSchema,
						table: "posts",
						primaryKeyColumn: "id",
						ids: [1, 2],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(2);

				const remainingPosts = yield* SqlClient.SqlClient;
				const posts =
					yield* remainingPosts`SELECT id FROM ${remainingPosts(config.defaultSchema)}.posts ORDER BY id`;
				expect(posts.length).toBe(2);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("returns rowsAffected: 0 when given empty array", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* bulkDeleteRows(
					{
						schema: config.defaultSchema,
						table: "users",
						primaryKeyColumn: "id",
						ids: [],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(0);

				const checkUsers = yield* SqlClient.SqlClient;
				const users =
					yield* checkUsers`SELECT COUNT(*) as count FROM ${checkUsers(config.defaultSchema)}.users`;
				expect(users[0].count).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("deletes single row", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* bulkDeleteRows(
					{
						schema: config.defaultSchema,
						table: "users",
						primaryKeyColumn: "id",
						ids: [1],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(1);

				const remainingUsers = yield* SqlClient.SqlClient;
				const users =
					yield* remainingUsers`SELECT id FROM ${remainingUsers(config.defaultSchema)}.users ORDER BY id`;
				expect(users.length).toBe(4);
				expect(users.map((u) => u.id)).toEqual([2, 3, 4, 5]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("handles deleting non-existent IDs gracefully", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* bulkDeleteRows(
					{
						schema: config.defaultSchema,
						table: "users",
						primaryKeyColumn: "id",
						ids: [999, 1000],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(0);

				const remainingUsers = yield* SqlClient.SqlClient;
				const users =
					yield* remainingUsers`SELECT COUNT(*) as count FROM ${remainingUsers(config.defaultSchema)}.users`;
				expect(users[0].count).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("deletes mixed existing and non-existing IDs", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* bulkDeleteRows(
					{
						schema: config.defaultSchema,
						table: "users",
						primaryKeyColumn: "id",
						ids: [1, 999, 2],
					},
					{ id: "test" } as any,
				);

				expect(result.rowsAffected).toBe(2);

				const remainingUsers = yield* SqlClient.SqlClient;
				const users =
					yield* remainingUsers`SELECT id FROM ${remainingUsers(config.defaultSchema)}.users ORDER BY id`;
				expect(users.length).toBe(3);
				expect(users.map((u) => u.id)).toEqual([3, 4, 5]);
			}).pipe(Effect.provide(testLayer));
		});
	};
};

describe("bulkDeleteRows", () => {
	describe("PostgreSQL", testSuite(pgliteLayer, postgresConfig));
	describe("SQLite", testSuite(libsqlLayer, sqliteConfig));
});
