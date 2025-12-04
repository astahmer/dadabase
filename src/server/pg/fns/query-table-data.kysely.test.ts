import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { queryTableRows } from "#src/server/introspection/introspection.ts";
import { PgLiteClient } from "@dadabase/effect-pglite";
import { SqlClient } from "@effect/sql";
import { LibsqlClient } from "@effect/sql-libsql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

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

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

const libsqlLayer = LibsqlClient.layer({
	url: ":memory:",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

const testSuite = (sqlLayer: Layer.Layer<SqlClient.SqlClient>) => () => {
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
				schema: "public",
				table: "users",
			});

			expect(result.rows.length).toBe(5);
			expect(result.rowCount).toBe(5);
			expect(result.rows[0]).toHaveProperty("id");
			expect(result.rows[0]).toHaveProperty("name");
			expect(result.rows[0]).toHaveProperty("email");
			expect(result.rows[0]).toHaveProperty("age");
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("applies limit correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				limit: 2,
			});

			expect(result.rows.length).toBe(2);
			// But rowCount should still reflect total count
			expect(result.rowCount).toBe(5);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("applies offset correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				limit: 2,
				offset: 2,
			});

			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(5);
			// Check that we got different rows due to offset
			const firstResult = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				limit: 2,
				offset: 0,
			});
			expect(result.rows[0].id).not.toBe(firstResult.rows[0].id);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("applies default limit of 50 when not specified", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
			});

			// We have 5 rows, which is less than default limit of 50
			expect(result.rows.length).toBe(5);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("applies default offset of 0 when not specified", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
			});

			// Should get first rows when no offset is provided
			expect(result.rows[0].id).toBe(1);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("orders by ascending when orderDirection not specified", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				orderBy: "age",
			});

			// Should be ordered by age ascending: 25, 28, 30, 32, 35
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([25, 28, 30, 32, 35]);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("orders by ascending direction explicitly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				orderBy: "name",
				orderDirection: "asc",
			});

			const names = result.rows.map((r) => r.name);
			expect(names).toEqual(["Alice", "Bob", "Charlie", "Diana", "Eve"]);
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("orders by descending direction", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows<User>({
				schema: "public",
				table: "users",
				orderBy: "age",
				orderDirection: "desc",
			});

			// Should be ordered by age descending: 35, 32, 30, 28, 25
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([35, 32, 30, 28, 25]);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(1);
			expect(result.rowCount).toBe(1);
			expect(result.rows[0].name).toBe("Alice");
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].name).toBe("Alice");
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(2); // Age 32 and 35
			expect(result.rowCount).toBe(2);
			const ages = result.rows.map((r) => r.age);
			expect(ages.every((age) => age > 30)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(2); // Age 25 and 28
			expect(result.rowCount).toBe(2);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].name).toBe("Charlie");
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Should match ages: 28, 30, 32 (not 25 or 35)
			expect(result.rows.length).toBe(3);
			const ages = result.rows.map((r) => r.age);
			expect(ages.every((age) => age > 25 && age < 35)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(2);
			const names = result.rows.map((r) => r.name).sort();
			expect(names).toEqual(["Alice", "Bob"]);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
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
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
				limit: 2, // Only retrieve 2 rows
			});

			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(4); // But total count after filter is 4
		}).pipe(Effect.provide(sqlLayer));
	});

	it.effect("queries from different table with relationships", () => {
		return Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
			});

			expect(result.rows.length).toBe(7); // We inserted 7 posts
			expect(result.rowCount).toBe(7);
			expect(result.rows[0]).toHaveProperty("user_id");
			expect(result.rows[0]).toHaveProperty("title");
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "posts",
				filters,
			});

			// Posts with published=true: 1, 2, 4, 6 = 4 posts
			expect(result.rowCount).toBe(4);
			// SQLite returns 0/1, PostgreSQL returns true/false
			expect(result.rows.every((row) => row.published)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(4); // All except Alice
			expect(result.rows.every((row) => row.name !== "Alice")).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "posts",
				filters,
			});

			expect(result.rowCount).toBe(1); // One post has NULL content
			expect(result.rows[0].content).toBeNull();
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "posts",
				filters,
			});

			expect(result.rowCount).toBe(6); // 6 posts have content
			expect(result.rows.every((row) => row.content !== null)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
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
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].id).toBe(3);
			expect(result.rows[0].name).toBe("Charlie");
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				limit: 10,
				offset: 0,
			});

			// Get second page
			const page2 = yield* queryTableRows<User>({
				schema: "public",
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
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// When filter value is undefined, it should be ignored and return all users
			expect(result.rows.length).toBe(5);
			expect(result.rowCount).toBe(5);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// When filter value is null, it should be ignored and return all users
			expect(result.rows.length).toBe(5);
			expect(result.rowCount).toBe(5);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Should only apply the age filter, ignoring the undefined name filter
			expect(result.rows.length).toBe(4); // Age > 25: 28, 30, 32, 35
			expect(result.rowCount).toBe(4);
		}).pipe(Effect.provide(sqlLayer));
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
					schema: "public",
					table: "users",
					filters,
				});

				// When all filter values are invalid, no filters should be applied
				expect(result.rows.length).toBe(5);
				expect(result.rowCount).toBe(5);
			}).pipe(Effect.provide(sqlLayer));
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
					schema: "public",
					table: "posts",
					filters,
				});

				// is_null should work without a value
				expect(result.rowCount).toBe(1);
				expect(result.rows[0].content).toBeNull();
			}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Alice, Charlie, Eve
			expect(result.rows.length).toBe(3);
			expect(result.rows.every((row) => row.name.endsWith("e"))).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Bob, Eve (no 'a' in name - case insensitive)
			expect(result.rows.length).toBe(2);
			expect(
				result.rows.every((row) => !row.name.toLowerCase().includes("a")),
			).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			expect(result.rows.length).toBe(3);
			const names = result.rows.map((r) => r.name).sort();
			expect(names).toEqual(["Alice", "Bob", "Charlie"]);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Alice (30), Eve (32), Charlie (35)
			expect(result.rows.length).toBe(3);
			expect(result.rows.every((row) => row.age >= 30)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
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
				schema: "public",
				table: "users",
				filters,
			});

			// Bob (25), Diana (28)
			expect(result.rows.length).toBe(2);
			expect(result.rows.every((row) => row.age <= 28)).toBe(true);
		}).pipe(Effect.provide(sqlLayer));
	});
};

describe("queryTableData (pglite)", testSuite(pgliteLayer));
describe("queryTableData (libsql)", testSuite(libsqlLayer));
