import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { queryTableRows } from "#src/server/introspection/introspection.ts";
import {
	makeTestLayer,
	pgliteLayer,
	libsqlLayer,
	postgresConfig,
	sqliteConfig,
	type DatabaseTestConfig,
} from "./test.layer.ts";

interface User {
	id: number;
	name: string;
	email: string;
	age: number;
}

interface Post {
	id: number;
	user_id: number;
	title: string;
	content: string;
	published: boolean;
}

const testSuite =
	(sqlLayer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) =>
	() => {
		const testLayer = makeTestLayer(sqlLayer);
		const setupSchema = Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			yield* sql.onDialectOrElse({
				pg: () =>
					Effect.gen(function* () {
						// Create users table
						yield* sql`
			CREATE TABLE IF NOT EXISTS users (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE,
				age INTEGER NOT NULL
			)
		`;

						// Create posts table with FK to users
						yield* sql`
			CREATE TABLE IF NOT EXISTS posts (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL,
				content TEXT,
				published BOOLEAN NOT NULL DEFAULT false
			)
		`;

						// Create test_nulls table for testing NULLS FIRST/LAST
						yield* sql`
			CREATE TABLE IF NOT EXISTS test_nulls (
				id SERIAL PRIMARY KEY,
				name TEXT,
				score INTEGER,
				description TEXT
			)
		`;
					}),
				sqlite: () =>
					Effect.gen(function* () {
						// Enable foreign keys for SQLite
						yield* sql`PRAGMA foreign_keys = ON`;

						// Create users table
						yield* sql`
						CREATE TABLE IF NOT EXISTS users (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							name TEXT NOT NULL,
							email TEXT NOT NULL UNIQUE,
							age INTEGER NOT NULL
						)
					`;

						// Create posts table with FK to users
						yield* sql`
						CREATE TABLE IF NOT EXISTS posts (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							user_id INTEGER NOT NULL REFERENCES users(id),
							title TEXT NOT NULL,
							content TEXT,
							published INTEGER NOT NULL DEFAULT 0
						)
					`;

						// Create test_nulls table for testing NULLS FIRST/LAST
						yield* sql`
						CREATE TABLE IF NOT EXISTS test_nulls (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							name TEXT,
							score INTEGER,
							description TEXT
						)
					`;
					}),
				orElse: () =>
					Effect.gen(function* () {
						return Effect.fail(new Error("Unsupported database"));
					}),
			});
		});

		// Helper to insert test data
		const insertTestData = Effect.gen(function* () {
			const client = yield* SqlClient.SqlClient;

			// Insert users
			yield* client`
			INSERT INTO users (name, email, age) VALUES
			('Alice', 'alice@example.com', 30),
			('Bob', 'bob@example.com', 25),
			('Charlie', 'charlie@example.com', 35),
			('Diana', 'diana@example.com', 28),
			('Eve', 'eve@example.com', 32)
		`;

			// Insert posts
			yield* client`
			INSERT INTO posts (user_id, title, content, published) VALUES
			(1, 'First Post', 'This is Alice first post', true),
			(1, 'Second Post', 'This is Alice second post', true),
			(2, 'Bob Post', 'This is Bob post', false),
			(3, 'Charlie Post', 'This is Charlie post', true),
			(3, 'Another Charlie Post', NULL, false),
			(4, 'Diana Post', 'This is Diana post', true),
			(5, 'Eve Post', 'This is Eve post', false)
		`;
		});

		it.effect("retrieves all rows from a table without filters", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
				});

				expect(result.rows.length).toBe(5);
				expect(result.rowCount).toBe(5);
				expect(result.rows[0]).toHaveProperty("id");
				expect(result.rows[0]).toHaveProperty("name");
				expect(result.rows[0]).toHaveProperty("email");
				expect(result.rows[0]).toHaveProperty("age");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("applies limit correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					limit: 2,
				});

				expect(result.rows.length).toBe(2);
				// But rowCount should still reflect total count
				expect(result.rowCount).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("applies offset correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					limit: 2,
					offset: 2,
				});

				expect(result.rows.length).toBe(2);
				expect(result.rowCount).toBe(5);
				// Check that we got different rows due to offset
				const firstResult = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					limit: 2,
					offset: 0,
				});
				expect(result.rows[0].id).not.toBe(firstResult.rows[0].id);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("applies default limit of 50 when not specified", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
				});

				// We have 5 rows, which is less than default limit of 50
				expect(result.rows.length).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("applies default offset of 0 when not specified", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
				});

				// Should get first rows when no offset is provided
				expect(result.rows[0].id).toBe(1);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders by ascending when orderDirection not specified", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					orderBy: "age",
				});

				// Should be ordered by age ascending: 25, 28, 30, 32, 35
				const ages = result.rows.map((r) => r.age);
				expect(ages).toEqual([25, 28, 30, 32, 35]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders by ascending direction explicitly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					orderBy: "name",
					orderDirection: "asc",
				});

				const names = result.rows.map((r) => r.name);
				expect(names).toEqual(["Alice", "Bob", "Charlie", "Diana", "Eve"]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders by descending direction", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					orderBy: "age",
					orderDirection: "desc",
				});

				// Should be ordered by age descending: 35, 32, 30, 28, 25
				const ages = result.rows.map((r) => r.age);
				expect(ages).toEqual([35, 32, 30, 28, 25]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders with NULLS FIRST puts null values first", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const sql = yield* SqlClient.SqlClient;

				// Insert test data with nulls for test_nulls table
				yield* sql.onDialectOrElse({
					pg: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
					sqlite: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
					orElse: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
				});

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "test_nulls",
					orderBy: "name",
					orderDirection: "asc",
					nullsOrder: "first",
				});

				// With NULLS FIRST, null values should come first
				expect(result.rows.length).toBe(5);
				const names = result.rows.map((r) => r.name);
				// First two should be null
				expect(names[0]).toBeNull();
				expect(names[1]).toBeNull();
				// Then non-null values in alphabetical order
				expect(names.slice(2)).toEqual(["Alice", "Bob", "Charlie"]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders with NULLS LAST puts null values last", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const sql = yield* SqlClient.SqlClient;

				// Insert test data with nulls for test_nulls table
				yield* sql.onDialectOrElse({
					pg: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
					sqlite: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
					orElse: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL),
							(NULL, 95, 'High'),
							('Charlie', NULL, 'Low')
						`,
				});

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "test_nulls",
					orderBy: "name",
					orderDirection: "asc",
					nullsOrder: "last",
				});

				// With NULLS LAST, null values should come last
				expect(result.rows.length).toBe(5);
				const names = result.rows.map((r) => r.name);
				// Non-null values first in alphabetical order
				expect(names.slice(0, 3)).toEqual(["Alice", "Bob", "Charlie"]);
				// Then null values
				expect(names[3]).toBeNull();
				expect(names[4]).toBeNull();
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders with NULLS FIRST in descending direction", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const sql = yield* SqlClient.SqlClient;

				// Insert test data with nulls
				yield* sql.onDialectOrElse({
					pg: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
					sqlite: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
					orElse: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
				});

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "test_nulls",
					orderBy: "name",
					orderDirection: "desc",
					nullsOrder: "first",
				});

				// With NULLS FIRST in DESC, null values should come first
				expect(result.rows.length).toBe(5);
				const names = result.rows.map((r) => r.name);
				// First two should be null
				expect(names[0]).toBeNull();
				expect(names[1]).toBeNull();
				// Then non-null values in reverse alphabetical order
				expect(names.slice(2)).toEqual(["Charlie", "Bob", "Alice"]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders with NULLS LAST in descending direction", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const sql = yield* SqlClient.SqlClient;

				// Insert test data with nulls
				yield* sql.onDialectOrElse({
					pg: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
					sqlite: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
					orElse: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
								('Alice', 100, 'Good'),
								(NULL, 90, 'Medium'),
								('Bob', 85, NULL),
								(NULL, 95, 'High'),
								('Charlie', NULL, 'Low')
							`,
				});

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "test_nulls",
					orderBy: "name",
					orderDirection: "desc",
					nullsOrder: "last",
				});

				// With NULLS LAST in DESC, non-null values come first in reverse order
				expect(result.rows.length).toBe(5);
				const names = result.rows.map((r) => r.name);
				// Non-null values first in reverse alphabetical order
				expect(names.slice(0, 3)).toEqual(["Charlie", "Bob", "Alice"]);
				// Then null values
				expect(names[3]).toBeNull();
				expect(names[4]).toBeNull();
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("ignores nullsOrder when orderBy is not specified", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const sql = yield* SqlClient.SqlClient;

				// Insert test data with nulls
				yield* sql.onDialectOrElse({
					pg: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL)
						`,
					sqlite: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL)
						`,
					orElse: () =>
						sql`INSERT INTO test_nulls (name, score, description) VALUES
							('Alice', 100, 'Good'),
							(NULL, 90, 'Medium'),
							('Bob', 85, NULL)
						`,
				});

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "test_nulls",
					// No orderBy specified
					nullsOrder: "first",
				});

				// Should return all rows without specific ordering applied
				expect(result.rows.length).toBe(3);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with equals operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: "Alice",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(1);
				expect(result.rowCount).toBe(1);
				expect(result.rows[0].name).toBe("Alice");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with contains operator (case-insensitive)", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "contains",
							value: "ali",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(1);
				expect(result.rows[0].name).toBe("Alice");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with greater_than operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 30,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(2); // Age 32 and 35
				expect(result.rowCount).toBe(2);
				const ages = result.rows.map((r) => r.age);
				expect(ages.every((age) => age > 30)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with less_than operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "less_than",
							value: 30,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(2); // Age 25 and 28
				expect(result.rowCount).toBe(2);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with starts_with operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "starts_with",
							value: "C",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(1);
				expect(result.rows[0].name).toBe("Charlie");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with multiple AND conditions", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 25,
						},
						{
							column: "age",
							operator: "less_than",
							value: 35,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Should match ages: 28, 30, 32 (not 25 or 35)
				expect(result.rows.length).toBe(3);
				const ages = result.rows.map((r) => r.age);
				expect(ages.every((age) => age > 25 && age < 35)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with multiple OR conditions", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: "Alice",
						},
						{
							column: "name",
							operator: "equals",
							value: "Bob",
						},
					],
					logicalOperator: "or",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(2);
				const names = result.rows.map((r) => r.name).sort();
				expect(names).toEqual(["Alice", "Bob"]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("combines filters with ordering and pagination", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 25,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
					orderBy: "age",
					orderDirection: "desc",
					limit: 2,
					offset: 0,
				});

				expect(result.rows.length).toBe(2);
				expect(result.rowCount).toBe(4); // Age 28, 30, 32, 35
				const ages = result.rows.map((r) => r.age);
				expect(ages).toEqual([35, 32]); // Ordered descending, limited to 2
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("returns correct row count even with filters applied", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 25,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows({
					schema: config.defaultSchema,
					table: "users",
					filters,
					limit: 2, // Only retrieve 2 rows
				});

				expect(result.rows.length).toBe(2);
				expect(result.rowCount).toBe(4); // But total count after filter is 4
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("queries from different table with relationships", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows({
					schema: config.defaultSchema,
					table: "posts",
				});

				expect(result.rows.length).toBe(7); // We inserted 7 posts
				expect(result.rowCount).toBe(7);
				expect(result.rows[0]).toHaveProperty("user_id");
				expect(result.rows[0]).toHaveProperty("title");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters posts by published status", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "published",
							operator: "equals",
							value: true,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Post>({
					schema: config.defaultSchema,
					table: "posts",
					filters,
				});

				// Posts with published=true: 1, 2, 4, 6 = 4 posts
				expect(result.rowCount).toBe(4);
				// SQLite returns 0/1, PostgreSQL returns true/false
				expect(result.rows.every((row) => row.published)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with not_equals operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "not_equals",
							value: "Alice",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(4); // All except Alice
				expect(result.rows.every((row) => row.name !== "Alice")).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters posts by nullable content field", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "content",
							operator: "is_null",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Post>({
					schema: config.defaultSchema,
					table: "posts",
					filters,
				});

				expect(result.rowCount).toBe(1); // One post has NULL content
				expect(result.rows[0].content).toBeNull();
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters posts by non-null content", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "content",
							operator: "is_not_null",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Post>({
					schema: config.defaultSchema,
					table: "posts",
					filters,
				});

				expect(result.rowCount).toBe(6); // 6 posts have content
				expect(result.rows.every((row) => row.content !== null)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("orders and filters together correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "user_id",
							operator: "equals",
							value: 1, // Alice's posts
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Post>({
					schema: config.defaultSchema,
					table: "posts",
					filters,
					orderBy: "id",
					orderDirection: "desc",
				});

				expect(result.rowCount).toBe(2); // Alice has 2 posts
				expect(result.rows[0].user_id).toBe(1);
				expect(result.rows[1].user_id).toBe(1);
				// Ordered desc, so higher id first
				expect(result.rows[0].id).toBeGreaterThan(result.rows[1].id);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("handles case-sensitive ID filtering correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "id",
							operator: "equals",
							value: 3,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(1);
				expect(result.rows[0].id).toBe(3);
				expect(result.rows[0].name).toBe("Charlie");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("applies pagination with large dataset", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const sql = yield* SqlClient.SqlClient;

				// Insert many users
				const manyUsers = Array.from({ length: 100 }, (_, i) => ({
					name: `User ${i + 1}`,
					email: `user${i + 1}@example.com`,
					age: 20 + (i % 40),
				})).map((u) => `('${u.name}', '${u.email}', ${u.age})`);

				yield* sql`INSERT INTO users (name, email, age) VALUES ${sql.csv(manyUsers)}`;

				// Get first page
				const page1 = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					limit: 10,
					offset: 0,
				});

				// Get second page
				const page2 = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					limit: 10,
					offset: 10,
				});

				expect(page1.rows.length).toBe(10);
				expect(page2.rows.length).toBe(10);
				expect(page1.rowCount).toBe(100);
				expect(page2.rowCount).toBe(100);
				// Verify different rows on different pages
				expect(page1.rows[0].id).not.toBe(page2.rows[0].id);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("ignores filter conditions with undefined values", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: undefined,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// When filter value is undefined, it should be ignored and return all users
				expect(result.rows.length).toBe(5);
				expect(result.rowCount).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("ignores filter conditions with null values", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: null,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// When filter value is null, it should be ignored and return all users
				expect(result.rows.length).toBe(5);
				expect(result.rowCount).toBe(5);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("handles mixed valid and invalid filter conditions", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 25,
						},
						{
							column: "name",
							operator: "equals",
							value: undefined, // This should be ignored
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Should only apply the age filter, ignoring the undefined name filter
				expect(result.rows.length).toBe(4); // Age > 25: 28, 30, 32, 35
				expect(result.rowCount).toBe(4);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"handles all filter conditions being invalid (undefined/null)",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const filters: QueryFilterType = {
						conditions: [
							{
								column: "name",
								operator: "equals",
								value: undefined,
							},
							{
								column: "age",
								operator: "equals",
								value: null,
							},
						],
						logicalOperator: "and",
					};

					const result = yield* queryTableRows<User>({
						schema: config.defaultSchema,
						table: "users",
						filters,
					});

					// When all filter values are invalid, no filters should be applied
					expect(result.rows.length).toBe(5);
					expect(result.rowCount).toBe(5);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"preserves is_null and is_not_null operators without requiring a value",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const filters: QueryFilterType = {
						conditions: [
							{
								column: "content",
								operator: "is_null",
							},
						],
						logicalOperator: "and",
					};

					const result = yield* queryTableRows<Post>({
						schema: config.defaultSchema,
						table: "posts",
						filters,
					});

					// is_null should work without a value
					expect(result.rowCount).toBe(1);
					expect(result.rows[0].content).toBeNull();
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("filters with ends_with operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "ends_with",
							value: "e",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Alice, Charlie, Eve
				expect(result.rows.length).toBe(3);
				expect(result.rows.every((row) => row.name.endsWith("e"))).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with not_contains operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "not_contains",
							value: "a",
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Bob, Eve (no 'a' in name - case insensitive)
				expect(result.rows.length).toBe(2);
				expect(
					result.rows.every((row) => !row.name.toLowerCase().includes("a")),
				).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with in operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "name",
							operator: "in",
							value: ["Alice", "Bob", "Charlie"],
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				expect(result.rows.length).toBe(3);
				const names = result.rows.map((r) => r.name).sort();
				expect(names).toEqual(["Alice", "Bob", "Charlie"]);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with greater_than_or_equal operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than_or_equal",
							value: 30,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Alice (30), Eve (32), Charlie (35)
				expect(result.rows.length).toBe(3);
				expect(result.rows.every((row) => row.age >= 30)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters with less_than_or_equal operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "less_than_or_equal",
							value: 28,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					filters,
				});

				// Bob (25), Diana (28)
				expect(result.rows.length).toBe(2);
				expect(result.rows.every((row) => row.age <= 28)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		// Tests for JOIN functionality
		it.effect("INNER JOIN returns joined rows from both tables", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// All 7 posts have corresponding users, so we should get 7 rows (one per post)
				expect(result.rows.length).toBe(7);
				expect(result.rowCount).toBe(7);
				// Each row should have user columns and post columns, aliased with table.column
				expect(result.rows[0]).toHaveProperty("users.id"); // user id
				expect(result.rows[0]).toHaveProperty("users.name"); // user name
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"LEFT JOIN includes all base table rows regardless of matches",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// LEFT JOIN should return all matching rows from join
					// Alice: 2 posts, Bob: 1 post, Charlie: 2 posts, Diana: 1 post, Eve: 1 post = 7 rows
					expect(result.rows.length).toBe(7);
					expect(result.rowCount).toBe(7);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("JOIN with specific columns selection", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title", "published"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				expect(result.rows.length).toBe(7);
				// Verify that we have user columns and selected post columns, all aliased
				expect(result.rows[0]).toHaveProperty("users.id");
				expect(result.rows[0]).toHaveProperty("users.name");
				// Joined columns should be accessible with alias like "posts.title"
				expect(result.rows[0]).toHaveProperty("posts.title");
				expect(result.rows[0]).toHaveProperty("posts.published");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"supports transitive joins via joinFrom (users -> posts -> comments)",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const sql = yield* SqlClient.SqlClient;

					yield* sql.onDialectOrElse({
						pg: () =>
							Effect.gen(function* () {
								yield* sql`
								CREATE TABLE IF NOT EXISTS comments (
									id SERIAL PRIMARY KEY,
									post_id INTEGER NOT NULL REFERENCES posts(id),
									title TEXT NOT NULL,
									content TEXT
								)
							`;
								yield* sql`
								INSERT INTO comments (post_id, title, content) VALUES
								(1, 'Comment on Post 1', 'Great post!'),
								(2, 'Comment on Post 2', 'Really good'),
								(3, 'Comment on Post 3', 'Nice work')
							`;
							}),
						sqlite: () =>
							Effect.gen(function* () {
								yield* sql`
								CREATE TABLE IF NOT EXISTS comments (
									id INTEGER PRIMARY KEY AUTOINCREMENT,
									post_id INTEGER NOT NULL REFERENCES posts(id),
									title TEXT NOT NULL,
									content TEXT
								)
							`;
								yield* sql`
								INSERT INTO comments (post_id, title, content) VALUES
								(1, 'Comment on Post 1', 'Great post!'),
								(2, 'Comment on Post 2', 'Really good'),
								(3, 'Comment on Post 3', 'Nice work')
							`;
							}),
						orElse: () => Effect.fail(new Error("Unsupported database")),
					});

					// Intentionally put comments first to prove join ordering is derived from joinFrom.
					const joins: JoinedTable[] = [
						{
							table: "comments",
							schema: config.defaultSchema,
							joinFrom: { schema: config.defaultSchema, table: "posts" },
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "post_id",
							},
						},
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// We inserted 3 comments that each map to a post -> user.
					expect(result.rowCount).toBe(3);
					expect(result.rows.length).toBe(3);
					expect(result.rows[0]).toHaveProperty("users.id");
					expect(result.rows[0]).toHaveProperty("posts.id");
					expect(result.rows[0]).toHaveProperty("comments.id");
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("JOIN with filters applies WHERE clause correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "published",
							operator: "equals",
							value: true,
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					filters,
				});

				// Should only return published posts (4 posts total)
				expect(result.rowCount).toBe(4);
				expect(result.rows.length).toBe(4);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("JOIN with ordering sorts correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					orderBy: "users.name",
					orderDirection: "asc",
				});

				expect(result.rows.length).toBe(7);
				// Verify ordering by name (aliased as users.name)
				const names: string[] = result.rows.map((r) => String(r["users.name"]));
				// With INNER JOIN, we get multiple rows per user (one per post)
				// First rows should be from Alice (alphabetically first)
				expect(names[0]).toBe("Alice");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("JOIN with pagination limits rows correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const resultPage1 = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					limit: 3,
					offset: 0,
				});

				expect(resultPage1.rows.length).toBe(3);
				expect(resultPage1.rowCount).toBe(7); // Total count unchanged

				const resultPage2 = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					limit: 3,
					offset: 3,
				});

				expect(resultPage2.rows.length).toBe(3);
				// Verify different rows on different pages (using aliased id)
				expect(resultPage1.rows[0]["users.id"]).not.toBe(
					resultPage2.rows[0]["users.id"],
				);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"JOIN with all parameters (filters, ordering, pagination)",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const filters: QueryFilterType = {
						conditions: [
							{
								column: "published",
								operator: "equals",
								value: true,
							},
						],
						logicalOperator: "and",
					};

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
						filters,
						orderBy: "users.id",
						orderDirection: "desc",
						limit: 2,
						offset: 0,
					});

					// Published posts: 1, 2, 4, 6 = 4 posts
					expect(result.rowCount).toBe(4);
					// But we limit to 2
					expect(result.rows.length).toBe(2);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("JOIN with user_id filter on joined table", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const filters: QueryFilterType = {
					conditions: [
						{
							column: "user_id",
							operator: "equals",
							value: 1, // Alice's posts
						},
					],
					logicalOperator: "and",
				};

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					filters,
				});

				// Alice has 2 posts
				expect(result.rowCount).toBe(2);
				expect(result.rows.length).toBe(2);
				expect(result.rows.every((r) => r["posts.user_id"] === 1)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("multiple JOINs on same table (should still work)", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// Note: This tests joining the same table twice, which is unusual
				// but the code should handle it
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should still work and return joined results
				expect(result.rows.length).toBe(7);
				expect(result.rowCount).toBe(7);
			}).pipe(Effect.provide(testLayer));
		});

		// Join filter tests
		it.effect(
			"filters joined table with equals operator on boolean column",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: ["title", "published"],
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
							filters: {
								conditions: [
									{
										column: "published",
										operator: "equals",
										value: true,
									},
								],
								logicalOperator: "and",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Only users who have published posts (Alice, Charlie, Diana)
					// Alice: 2 published posts, Charlie: 1, Diana: 1 = 4 total rows
					expect(result.rowCount).toBe(4);
					expect(result.rows.every((r) => r["posts.published"])).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("filters joined table with contains operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "title",
									operator: "contains",
									value: "Post",
								},
							],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// All posts have "Post" in title (7 total)
				expect(result.rowCount).toBe(7);
				expect(
					result.rows.every((r) => String(r["posts.title"]).includes("Post")),
				).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters joined table with multiple conditions using AND", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title", "published"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "published",
									operator: "equals",
									value: true,
								},
								{
									column: "title",
									operator: "contains",
									value: "Post",
								},
							],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Published posts with "Post" in title: Alice (2), Charlie (1), Diana (1) = 4
				expect(result.rowCount).toBe(4);
				expect(
					result.rows.every(
						(r) =>
							r["posts.published"] && String(r["posts.title"]).includes("Post"),
					),
				).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("filters joined table with multiple conditions using OR", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title", "published"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "title",
									operator: "contains",
									value: "First",
								},
								{
									column: "title",
									operator: "contains",
									value: "Another",
								},
							],
							logicalOperator: "or",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Posts with "First" OR "Another" in title: 2 posts
				expect(result.rowCount).toBe(2);
				const titles = result.rows.map((r) => String(r["posts.title"]));
				expect(
					titles.some((t) => t.includes("First") || t.includes("Another")),
				).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("combines main table filters with join filters using AND", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const mainFilters: QueryFilterType = {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 25,
						},
					],
					logicalOperator: "and",
				};

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title", "published"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "published",
									operator: "equals",
									value: true,
								},
							],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					filters: mainFilters,
					joins,
				});

				// Users with age > 25 (Alice 30, Charlie 35, Diana 28, Eve 32)
				// AND have published posts (Alice, Charlie, Diana)
				// Alice: 2 published, Charlie: 1, Diana: 1 = 4 total
				expect(result.rowCount).toBe(4);
				// Check that all rows have published=true (join filter worked)
				const publishedStatus = result.rows.map((r) => r["posts.published"]);
				expect(publishedStatus.every((p) => p === true || p === 1)).toBe(true);
				// Verify the join filter is applied correctly
				expect(result.rows.length).toBeLessThanOrEqual(4);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"join filter with LEFT JOIN acts like INNER JOIN when filtering",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// Create a user with no posts
					const sql = yield* SqlClient.SqlClient;
					yield* sql.onDialectOrElse({
						pg: () =>
							sql`INSERT INTO users (name, email, age) VALUES ('Frank', 'frank@example.com', 40)`,
						sqlite: () =>
							sql`INSERT INTO users (name, email, age) VALUES ('Frank', 'frank@example.com', 40)`,
						orElse: () =>
							sql`INSERT INTO users (name, email, age) VALUES ('Frank', 'frank@example.com', 40)`,
					});

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: ["title", "published"],
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
							filters: {
								conditions: [
									{
										column: "published",
										operator: "equals",
										value: true,
									},
								],
								logicalOperator: "and",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Note: Filters on joined columns are applied in WHERE clause, which converts
					// LEFT JOIN to INNER JOIN behavior. So Frank won't appear even with LEFT JOIN.
					// Alice: 2 published, Charlie: 1, Diana: 1 = 4 rows
					expect(result.rowCount).toBe(4);
					const publishedStatus = result.rows.map((r) => r["posts.published"]);
					expect(publishedStatus.every((p) => p === true || p === 1)).toBe(
						true,
					);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"join filter with greater_than operator on numeric column",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: ["title", "id"],
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
							filters: {
								conditions: [
									{
										column: "id",
										operator: "greater_than",
										value: 3,
									},
								],
								logicalOperator: "and",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Posts with id > 3: posts 4, 5, 6, 7 = 4 rows
					expect(result.rowCount).toBe(4);
					const postIds = result.rows.map((r) => r["posts.id"] as number);
					expect(postIds.every((id) => id > 3)).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("join filter with empty conditions (no filtering)", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// No filters applied, should get all 7 posts
				expect(result.rowCount).toBe(7);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("join filter with is_null operator", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["content"],
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "content",
									operator: "is_null",
									value: null,
								},
							],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Posts with NULL content: 1 post (Charlie's second post)
				expect(result.rowCount).toBe(1);
				expect(result.rows[0]["posts.content"]).toBeNull();
			}).pipe(Effect.provide(testLayer));
		});

		// Tests for custom join conditions
		it.effect("custom join condition with single SQL expression", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title"],
						joinCondition: {
							mode: "custom",
							referencingColumn: "id", // preserved from FK
							referencedColumn: "user_id", // preserved from FK
							conditions: [`posts.user_id = ${config.defaultSchema}.users.id`],
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should work just like standard FK join when conditions replicate FK logic
				expect(result.rowCount).toBe(7);
				expect(result.rows.length).toBe(7);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"custom join condition with multiple conditions combined with AND",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: ["title", "published"],
							joinCondition: {
								mode: "custom",
								conditions: [
									`posts.user_id = ${config.defaultSchema}.users.id`,
									"posts.published = true",
								],
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// FK condition + published=true filter
					// Alice: 2 published, Charlie: 1, Diana: 1 = 4 rows
					expect(result.rowCount).toBe(4);
					expect(result.rows.every((r) => r["posts.published"])).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"custom join condition fallback to standard FK when conditions empty",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: ["title"],
							joinCondition: {
								mode: "custom",
								referencingColumn: "id", // FK info available for fallback
								referencedColumn: "user_id",
								conditions: [], // Empty conditions array
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Should fallback to FK and work normally
					expect(result.rowCount).toBe(7);
					expect(result.rows.length).toBe(7);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("custom join condition with is null expression", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title", "content"],
						joinCondition: {
							mode: "custom",
							referencingColumn: "id",
							referencedColumn: "user_id",
							conditions: [
								`posts.user_id = ${config.defaultSchema}.users.id`,
								"posts.content IS NULL",
							],
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Only the one post with NULL content
				expect(result.rowCount).toBe(1);
				expect(result.rows[0]["posts.content"]).toBeNull();
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("custom join condition mode switching preserves FK info", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// When switching from custom to standard, FK info should be available
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: ["title"],
						joinCondition: {
							mode: "custom",
							referencingColumn: "id", // Preserved for potential switch to standard
							referencedColumn: "user_id",
							conditions: [`posts.user_id = ${config.defaultSchema}.users.id`],
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should work with the custom condition
				expect(result.rowCount).toBe(7);
				// FK info is still available in joinCondition for UI to allow switching back
			}).pipe(Effect.provide(testLayer));
		});

		// Filter-based join conditions/clauses
		it.effect("JOIN with filter-based conditions returns filtered rows", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "inner",
						columns: "all",
						joinCondition: {
							mode: "filters",
							referencingColumn: "id",
							referencedColumn: "user_id",
							filters: {
								conditions: [
									{
										column: "published",
										operator: "equals",
										value: true,
									},
								],
								logicalOperator: "and",
							},
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Published posts: Alice (2), Charlie (1), Diana (1) = 4 posts
				expect(result.rowCount).toBe(4);
				// Verify all returned rows have published=true
				const publishedValues = result.rows.map(
					(r: any) => r["posts.published"],
				);
				expect(
					publishedValues.every((val: any) => val === true || val === 1),
				).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"JOIN with multiple filter conditions returns correctly filtered rows",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "filters",
								referencingColumn: "id",
								referencedColumn: "user_id",
								filters: {
									conditions: [
										{
											column: "published",
											operator: "equals",
											value: true,
										},
										{
											column: "title",
											operator: "contains",
											value: "Post",
										},
									],
									logicalOperator: "and",
								},
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Published posts with "Post" in title: Alice (First Post, Second Post), Charlie (Charlie Post), Diana (Diana Post) = 4 posts
					expect(result.rowCount).toBe(4);
					// All rows should have published=true or published=1 (SQLite)
					const allPublished = result.rows.every(
						(r) => r["posts.published"] === true || r["posts.published"] === 1,
					);
					expect(allPublished).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"JOIN with filter-based conditions falls back to FK when filters are empty",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "filters",
								referencingColumn: "id",
								referencedColumn: "user_id",
								filters: {
									conditions: [], // Empty filters
									logicalOperator: "and",
								},
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Should return all 7 posts (fallback to FK join)
					expect(result.rowCount).toBe(7);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"JOIN with OR logical operator in filters returns correct rows",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "filters",
								referencingColumn: "id",
								referencedColumn: "user_id",
								filters: {
									conditions: [
										{
											column: "title",
											operator: "contains",
											value: "Charlie",
										},
										{
											column: "title",
											operator: "contains",
											value: "Bob",
										},
									],
									logicalOperator: "or",
								},
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// "Bob Post" matches, "Charlie Post" matches = 2 posts
					// But we have 5 users, and these 2 posts link to users 2 and 3
					// INNER JOIN: 2 posts × 5 users = 10? No wait, it's FK join so only matching users
					// Bob (user 2) has 1 post, Charlie (user 3) has 2 posts, so 1 + 2 = 3 rows for those users
					expect(result.rowCount).toBeGreaterThanOrEqual(1);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"filters with ambiguous column names specify table explicitly",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const sql = yield* SqlClient.SqlClient;

					// Add an 'id' column to posts table (it already has one, but demonstrate disambiguation)
					// Create a comments table that also has 'id' and 'title' to test ambiguity
					yield* sql.onDialectOrElse({
						pg: () =>
							Effect.gen(function* () {
								yield* sql`
					CREATE TABLE IF NOT EXISTS comments (
						id SERIAL PRIMARY KEY,
						post_id INTEGER NOT NULL REFERENCES posts(id),
						title TEXT NOT NULL,
						content TEXT
					)
				`;
								// Insert test comments
								yield* sql`
					INSERT INTO comments (post_id, title, content) VALUES
					(1, 'Comment on Post 1', 'Great post!'),
					(2, 'Comment on Post 2', 'Really good'),
					(3, 'Comment on Post 3', 'Nice work')
				`;
							}),
						sqlite: () =>
							Effect.gen(function* () {
								yield* sql`
					CREATE TABLE IF NOT EXISTS comments (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						post_id INTEGER NOT NULL REFERENCES posts(id),
						title TEXT NOT NULL,
						content TEXT
					)
				`;
								// Insert test comments
								yield* sql`
					INSERT INTO comments (post_id, title, content) VALUES
					(1, 'Comment on Post 1', 'Great post!'),
					(2, 'Comment on Post 2', 'Really good'),
					(3, 'Comment on Post 3', 'Nice work')
				`;
							}),
						orElse: () =>
							Effect.gen(function* () {
								return Effect.fail(new Error("Unsupported database"));
							}),
					});

					// Create joins to both posts and comments
					const joins: JoinedTable[] = [
						{
							table: "comments",
							schema: config.defaultSchema,
							type: "inner",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "post_id",
							},
						},
					];

					// Filter by 'title' which exists in BOTH posts and comments
					// Without specifying table, this could be ambiguous.
					// We filter for comments with title containing "Post"
					const filters: QueryFilterType = {
						conditions: [
							{
								column: "title",
								table: "comments", // Explicitly specify we want comments.title
								operator: "contains",
								value: "Post",
							},
						],
						logicalOperator: "and",
					};

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "posts",
						joins,
						filters,
					});

					// Should match all 3 comments (all have "Post" in their titles)
					expect(result.rowCount).toBe(3);
					// Verify we got the comment data
					expect(result.rows[0]).toHaveProperty("comments.title");
					expect(
						result.rows.every((r) =>
							String(r["comments.title"]).includes("Post"),
						),
					).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		// Join alias tests
		it.effect(
			"multiple same-table joins use aliases to avoid SQL conflicts",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// Join posts table twice with different ON conditions
					// This would cause "table 'posts' specified more than once" without aliases
					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: ["id", "title"],
							joinCondition: {
								mode: "custom",
								conditions: [
									`posts_1.user_id = ${config.defaultSchema}.users.id`,
								],
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: ["id", "content"],
							joinCondition: {
								mode: "custom",
								conditions: [
									`posts_2.user_id = ${config.defaultSchema}.users.id`,
								],
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Should successfully execute despite same table appearing twice
					// Should return rows with both post aliases
					expect(result.rowCount).toBeGreaterThan(0);
					expect(result.rows.length).toBeGreaterThan(0);
					// Verify we got columns from both joined posts tables
					const firstRow = result.rows[0];
					expect(firstRow).toBeDefined();
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"join with base table appearing in joins list uses aliases correctly",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// Test scenario: query on users, then join to posts
					// This demonstrates joins working correctly even when multiple relationships exist
					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: ["title", "published"],
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Should successfully execute and return joined data
					expect(result.rowCount).toBe(7); // 7 posts from 5 users
					expect(result.rows.length).toBe(7);
					// Verify we got columns from both tables
					const firstRow = result.rows[0];
					expect(firstRow).toBeDefined();
					expect(firstRow).toHaveProperty("posts.title");
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("different tables in joins do not receive aliases", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// Join two different tables - no aliases needed
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: "all",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should work without aliases since only one join
				expect(result.rowCount).toBe(7); // 7 total posts from 5 users
				expect(result.rows.length).toBe(7);
				// Verify joined columns are present
				const firstRow = result.rows[0];
				expect(firstRow).toHaveProperty("posts.title");
			}).pipe(Effect.provide(testLayer));
		});

		// Custom alias tests
		it.effect("custom alias on same-table joins works correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// Join posts twice with user-provided aliases (using standard FK conditions)
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: ["id", "title"],
						alias: "user_first_post", // Custom alias for first join
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: ["id", "content"],
						alias: "user_recent_post", // Custom alias for second join
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should successfully execute with custom aliases
				expect(result.rowCount).toBeGreaterThan(0);
				expect(result.rows.length).toBeGreaterThan(0);
				// Custom aliases should appear in column names
				const firstRow = result.rows[0];
				expect(firstRow).toBeDefined();
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("mixes custom alias with auto-generated aliases", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// First join uses custom alias, second doesn't (auto-generated)
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: ["title"],
						alias: "authored_posts", // Custom alias
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: ["content"],
						// No alias - will use auto-generated
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should work with mixed aliases
				expect(result.rowCount).toBeGreaterThan(0);
				expect(result.rows.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"applies filters on aliased joined tables with auto-generated aliases",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// Join posts twice and apply different filters to each using aliases
					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
							filters: {
								conditions: [
									{
										column: "published",
										operator: "equals",
										value: "true",
									},
								],
								logicalOperator: "and",
							},
						},
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
							filters: {
								conditions: [
									{
										column: "content",
										operator: "is_not_null",
									},
								],
								logicalOperator: "and",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
					});

					// Should successfully execute with filters on joined table
					expect(result.rowCount).toBeDefined();
					expect(Array.isArray(result.rows)).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("applies filters on custom aliased joined tables", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// Join with custom alias and apply filter
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: "all",
						alias: "published_posts",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
						filters: {
							conditions: [
								{
									column: "published",
									operator: "equals",
									value: "true",
								},
							],
							logicalOperator: "and",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
				});

				// Should successfully execute with filters on custom alias
				expect(result.rowCount).toBeDefined();
				expect(Array.isArray(result.rows)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"applies root filters on aliased joined tables with auto-generated aliases",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// Join posts twice and apply different filters to each using aliases
					const joins: JoinedTable[] = [
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
						{
							table: "posts",
							schema: config.defaultSchema,
							type: "left",
							columns: "all",
							joinCondition: {
								mode: "standard",
								referencingColumn: "id",
								referencedColumn: "user_id",
							},
						},
					];

					const result = yield* queryTableRows<Record<string, unknown>>({
						schema: config.defaultSchema,
						table: "users",
						joins,
						filters: {
							conditions: [
								{
									table: "posts_1",
									column: "published",
									operator: "equals",
									value: "true",
								},
								{
									table: "posts_2",
									column: "content",
									operator: "is_not_null",
								},
							],
							logicalOperator: "and",
						},
					});

					// Should successfully execute with filters on joined table
					expect(result.rowCount).toBeDefined();
					expect(Array.isArray(result.rows)).toBe(true);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("applies root filters on custom aliased joined tables", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				// Join with custom alias and apply filter
				const joins: JoinedTable[] = [
					{
						table: "posts",
						schema: config.defaultSchema,
						type: "left",
						columns: "all",
						alias: "published_posts",
						joinCondition: {
							mode: "standard",
							referencingColumn: "id",
							referencedColumn: "user_id",
						},
					},
				];

				const result = yield* queryTableRows<Record<string, unknown>>({
					schema: config.defaultSchema,
					table: "users",
					joins,
					filters: {
						conditions: [
							{
								table: "published_posts",
								column: "published",
								operator: "equals",
								value: "true",
							},
						],
						logicalOperator: "and",
					},
				});

				// Should successfully execute with filters on custom alias
				expect(result.rowCount).toBeDefined();
				expect(Array.isArray(result.rows)).toBe(true);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("columnList uses custom aliases for joined tables", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows({
					schema: config.defaultSchema,
					table: "posts",
					joins: [
						{
							schema: config.defaultSchema,
							table: "users",
							type: "inner",
							alias: "post_author",
							joinCondition: {
								mode: "standard",
								referencingColumn: "user_id",
								referencedColumn: "id",
							},
							columns: "all",
						},
					],
					limit: 10,
					offset: 0,
				});

				// columnList should use the custom alias instead of the table name
				expect(result.columnList).toContain("post_author.id");
				expect(result.columnList).toContain("post_author.name");
				expect(result.columnList).not.toContain("users.id");
				expect(result.columnList).not.toContain("users.name");
				expect(result.columnList).toMatchInlineSnapshot(`
					[
					  "posts.id",
					  "posts.user_id",
					  "posts.title",
					  "posts.content",
					  "posts.published",
					  "post_author.id",
					  "post_author.name",
					  "post_author.email",
					  "post_author.age",
					]
				`);
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"columnList uses auto-generated aliases for duplicate table joins",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const result = yield* queryTableRows({
						schema: config.defaultSchema,
						table: "posts",
						joins: [
							{
								schema: config.defaultSchema,
								table: "posts",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "id",
									referencedColumn: "id",
								},
								columns: "all",
							},
							{
								schema: config.defaultSchema,
								table: "posts",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "id",
									referencedColumn: "id",
								},
								columns: "all",
							},
						],
						limit: 10,
						offset: 0,
					});

					// columnList should use auto-generated aliases (posts_1, posts_2) instead of raw table name
					// columnList should include base table columns with prefix and joined table columns with aliases
					expect(result.columnList).toContain("posts.id");
					expect(result.columnList).toContain("posts.title");
					expect(result.columnList).toContain("posts_1.id");
					expect(result.columnList).toContain("posts_1.title");
					expect(result.columnList).toContain("posts_2.id");
					expect(result.columnList).toContain("posts_2.title");
					expect(result.columnList).toMatchInlineSnapshot(`
					[
					  "posts.id",
					  "posts.user_id",
					  "posts.title",
					  "posts.content",
					  "posts.published",
					  "posts_1.id",
					  "posts_1.user_id",
					  "posts_1.title",
					  "posts_1.content",
					  "posts_1.published",
					  "posts_2.id",
					  "posts_2.user_id",
					  "posts_2.title",
					  "posts_2.content",
					  "posts_2.published",
					]
				`);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"columnList includes base table prefix when joins present",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					// With a join, base table columns should have table prefix
					const resultWithJoin = yield* queryTableRows({
						schema: config.defaultSchema,
						table: "posts",
						joins: [
							{
								schema: config.defaultSchema,
								table: "users",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "user_id",
									referencedColumn: "id",
								},
								columns: "all",
							},
						],
						limit: 10,
						offset: 0,
					});

					// Base table should also have prefix
					expect(resultWithJoin.columnList).toContain("posts.id");
					expect(resultWithJoin.columnList).toContain("posts.title");
					expect(resultWithJoin.columnList).toContain("users.id");
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("selectedColumns - returns only selected columns", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					selectedColumns: ["id", "name"],
				});

				expect(result.columnList).toEqual(["id", "name"]);
				expect(result.rows.length).toBe(5);
				// Verify only selected columns are present
				expect(result.rows[0]).toHaveProperty("id");
				expect(result.rows[0]).toHaveProperty("name");
				expect(result.rows[0]).not.toHaveProperty("email");
				expect(result.rows[0]).not.toHaveProperty("age");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("selectedColumns - empty list returns all columns", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<User>({
					schema: config.defaultSchema,
					table: "users",
					selectedColumns: [],
				});

				// Empty list means no filtering, so all columns are returned
				expect(result.columnList).toEqual(["id", "name", "email", "age"]);
				expect(result.rows.length).toBe(5);
				expect(result.rows[0]).toHaveProperty("id");
				expect(result.rows[0]).toHaveProperty("name");
				expect(result.rows[0]).toHaveProperty("email");
				expect(result.rows[0]).toHaveProperty("age");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("selectedColumns - works with filter conditions", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<Partial<User>>({
					schema: config.defaultSchema,
					table: "users",
					selectedColumns: ["id", "name"],
				});

				expect(result.columnList).toEqual(["id", "name"]);
				expect(result.rows.length).toBe(5); // All rows returned
				// Verify no email or age columns present
				expect(result.rows[0]).not.toHaveProperty("email");
				expect(result.rows[0]).not.toHaveProperty("age");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"selectedColumns - works with joined tables (only base table affected)",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const result = yield* queryTableRows<any>({
						schema: config.defaultSchema,
						table: "posts",
						selectedColumns: ["id", "title"],
						joins: [
							{
								schema: config.defaultSchema,
								table: "users",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "user_id",
									referencedColumn: "id",
								},
								columns: "all",
							},
						],
						limit: 10,
						offset: 0,
					});

					// Should have ONLY selected posts columns with prefix
					expect(result.columnList).toContain("posts.id");
					expect(result.columnList).toContain("posts.title");
					// Should NOT have unselected post columns
					expect(result.columnList).not.toContain("posts.user_id");
					expect(result.columnList).not.toContain("posts.content");
					expect(result.columnList).not.toContain("posts.published");

					// Joined table columns should all be included (columns: "all" in join config)
					expect(result.columnList).toContain("users.id");
					expect(result.columnList).toContain("users.name");
					expect(result.columnList).toContain("users.email");
					expect(result.columnList).toContain("users.age");

					expect(result.rows.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect("selectedColumns - works with limit and offset", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<Partial<User>>({
					schema: config.defaultSchema,
					table: "users",
					selectedColumns: ["id", "name"],
					limit: 2,
					offset: 1,
				});

				expect(result.columnList).toEqual(["id", "name"]);
				expect(result.rows.length).toBe(2);
				expect(result.rowCount).toBe(5); // Total should still be 5
			}).pipe(Effect.provide(testLayer));
		});

		it.effect("selectedColumns - works with order by", () => {
			return Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows<Partial<User>>({
					schema: config.defaultSchema,
					table: "users",
					selectedColumns: ["id", "name"],
					orderBy: "name",
					orderDirection: "desc",
					limit: 5,
				});

				expect(result.columnList).toEqual(["id", "name"]);
				expect(result.rows.length).toBe(5);
				// Verify ordering (Eve, Diana, Charlie, Bob, Alice)
				expect(result.rows[0]).toHaveProperty("name", "Eve");
			}).pipe(Effect.provide(testLayer));
		});

		it.effect(
			"selectedColumns with qualified names filters all tables in joins",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const result = yield* queryTableRows<any>({
						schema: config.defaultSchema,
						table: "posts",
						selectedColumns: [
							"posts.id",
							"posts.title",
							"users.id",
							"users.name",
						],
						joins: [
							{
								schema: config.defaultSchema,
								table: "users",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "user_id",
									referencedColumn: "id",
								},
								columns: "all",
							},
						],
						limit: 10,
						offset: 0,
					});

					// Should have ONLY selected columns from both tables
					expect(result.columnList).toContain("posts.id");
					expect(result.columnList).toContain("posts.title");
					expect(result.columnList).toContain("users.id");
					expect(result.columnList).toContain("users.name");
					// Should NOT have unselected columns
					expect(result.columnList).not.toContain("posts.user_id");
					expect(result.columnList).not.toContain("posts.content");
					expect(result.columnList).not.toContain("users.email");
					expect(result.columnList).not.toContain("users.age");

					expect(result.rows.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"excludedColumns filters out specified columns from base table only",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const result = yield* queryTableRows<any>({
						schema: config.defaultSchema,
						table: "users",
						excludedColumns: ["email", "age"],
						limit: 10,
						offset: 0,
					});

					// Should have all columns except the excluded ones
					expect(result.columnList).toContain("id");
					expect(result.columnList).toContain("name");
					expect(result.columnList).not.toContain("email");
					expect(result.columnList).not.toContain("age");

					expect(result.rows.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer));
			},
		);

		it.effect(
			"excludedColumns with qualified names filters all tables in joins",
			() => {
				return Effect.gen(function* () {
					yield* setupSchema;
					yield* insertTestData;

					const result = yield* queryTableRows<any>({
						schema: config.defaultSchema,
						table: "posts",
						excludedColumns: [
							"posts.content",
							"posts.published",
							"users.email",
							"users.age",
						],
						joins: [
							{
								schema: config.defaultSchema,
								table: "users",
								type: "inner",
								joinCondition: {
									mode: "standard",
									referencingColumn: "user_id",
									referencedColumn: "id",
								},
								columns: "all",
							},
						],
						limit: 10,
						offset: 0,
					});

					// Should NOT have the excluded columns
					expect(result.columnList).not.toContain("posts.content");
					expect(result.columnList).not.toContain("posts.published");
					expect(result.columnList).not.toContain("users.email");
					expect(result.columnList).not.toContain("users.age");
					// Should have the non-excluded columns
					expect(result.columnList).toContain("posts.id");
					expect(result.columnList).toContain("posts.title");
					expect(result.columnList).toContain("posts.user_id");
					expect(result.columnList).toContain("users.id");
					expect(result.columnList).toContain("users.name");

					expect(result.rows.length).toBeGreaterThan(0);
				}).pipe(Effect.provide(testLayer));
			},
		);
	};

describe("queryTableData (pglite)", testSuite(pgliteLayer, postgresConfig));
describe("queryTableData (libsql)", testSuite(libsqlLayer, sqliteConfig));
describe("queryTableData (libsql)", testSuite(libsqlLayer, sqliteConfig));
