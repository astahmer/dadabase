import { PgLiteClient } from "@dadabase/effect-pglite";
import { describe, expect, it } from "@effect/vitest";
import { SqlClient } from "@effect/sql";
import { Effect, Layer } from "effect";
import { queryTableRows } from "./introspection.ts";

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

describe("queryTableRows", () => {
	// Helper to set up test schema
	const setupSchema = Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		// Create users table
		yield* client`
			CREATE TABLE IF NOT EXISTS users (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE,
				age INTEGER NOT NULL
			)
		`;

		// Create posts table with FK to users
		yield* client`
			CREATE TABLE IF NOT EXISTS posts (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL,
				content TEXT,
				published BOOLEAN NOT NULL DEFAULT false
			)
		`;
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

	it.effect("retrieves all rows from a table without filters", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
			});

			expect(result.rows.length).toBe(5);
			expect(result.rowCount).toBe(5);
			expect(result.rows[0]).toHaveProperty("id");
			expect(result.rows[0]).toHaveProperty("name");
			expect(result.rows[0]).toHaveProperty("email");
			expect(result.rows[0]).toHaveProperty("age");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("applies limit correctly", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				limit: 2,
			});

			expect(result.rows.length).toBe(2);
			// But rowCount should still reflect total count
			expect(result.rowCount).toBe(5);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("applies offset correctly", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				limit: 2,
				offset: 2,
			});

			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(5);

			// Check that we got different rows due to offset
			const firstResult = yield* queryTableRows({
				schema: "public",
				table: "users",
				limit: 2,
				offset: 0,
			});
			expect(result.rows[0].id).not.toBe(firstResult.rows[0].id);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("applies default limit of 50 when not specified", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
			});

			// We have 5 rows, which is less than default limit of 50
			expect(result.rows.length).toBe(5);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("applies default offset of 0 when not specified", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
			});

			// Should get first rows when no offset is provided
			expect(result.rows[0].id).toBe(1);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("orders by ascending when orderDirection not specified", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				orderBy: "age",
			});

			// Should be ordered by age ascending: 25, 28, 30, 32, 35
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([25, 28, 30, 32, 35]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("orders by ascending direction explicitly", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				orderBy: "name",
				orderDirection: "asc",
			});

			const names = result.rows.map((r) => r.name);
			expect(names).toEqual(["Alice", "Bob", "Charlie", "Diana", "Eve"]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("orders by descending direction", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				orderBy: "age",
				orderDirection: "desc",
			});

			// Should be ordered by age descending: 35, 32, 30, 28, 25
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([35, 32, 30, 28, 25]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with equals operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: "Alice",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(1);
			expect(result.rowCount).toBe(1);
			expect(result.rows[0].name).toBe("Alice");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with contains operator (case-insensitive)", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "contains",
							value: "ali",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].name).toBe("Alice");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with greater_than operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 30,
						},
					],
					logicalOperator: "and",
				},
			});

			// Charlie (35), Eve (32)
			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(2);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with less_than operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "age",
							operator: "less_than",
							value: 30,
						},
					],
					logicalOperator: "and",
				},
			});

			// Bob (25), Diana (28)
			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(2);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with is_null operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
				filters: {
					conditions: [
						{
							column: "content",
							operator: "is_null",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].title).toBe("Another Charlie Post");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with is_not_null operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
				filters: {
					conditions: [
						{
							column: "content",
							operator: "is_not_null",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(6);
			expect(result.rowCount).toBe(6);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with multiple conditions using AND", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "age",
							operator: "greater_than_or_equal",
							value: 28,
						},
						{
							column: "age",
							operator: "less_than_or_equal",
							value: 32,
						},
					],
					logicalOperator: "and",
				},
			});

			// Alice (30), Diana (28), Eve (32)
			expect(result.rows.length).toBe(3);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with multiple conditions using OR", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
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
				},
			});

			expect(result.rows.length).toBe(2);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("combines filtering with ordering", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				orderBy: "age",
				orderDirection: "desc",
				filters: {
					conditions: [
						{
							column: "age",
							operator: "greater_than",
							value: 28,
						},
					],
					logicalOperator: "and",
				},
			});

			// Charlie (35), Eve (32), Alice (30) in descending order
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([35, 32, 30]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("combines filtering with pagination", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				limit: 2,
				offset: 1,
				orderBy: "age",
				orderDirection: "asc",
				filters: {
					conditions: [
						{
							column: "age",
							operator: "greater_than_or_equal",
							value: 25,
						},
					],
					logicalOperator: "and",
				},
			});

			// All 5 users match, ordered by age asc: 25, 28, 30, 32, 35
			// With offset 1 and limit 2: 28, 30
			expect(result.rows.length).toBe(2);
			expect(result.rowCount).toBe(5);
			const ages = result.rows.map((r) => r.age);
			expect(ages).toEqual([28, 30]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with starts_with operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "starts_with",
							value: "Ch",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].name).toBe("Charlie");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with ends_with operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "ends_with",
							value: "e",
						},
					],
					logicalOperator: "and",
				},
			});

			// Alice, Charlie, Eve
			expect(result.rows.length).toBe(3);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with not_equals operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "not_equals",
							value: "Alice",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(4);
			expect(result.rows.every((r) => r.name !== "Alice")).toBe(true);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with not_contains operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "not_contains",
							value: "a",
						},
					],
					logicalOperator: "and",
				},
			});

			// Bob, Eve (no 'a' in name - case insensitive check)
			expect(result.rows.length).toBe(2);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters with in operator", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "in",
							value: ["Alice", "Bob", "Charlie"],
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(3);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("ignores conditions with undefined values", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: undefined,
						},
					],
					logicalOperator: "and",
				},
			});

			// Should return all rows since condition is ignored
			expect(result.rows.length).toBe(5);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns empty result for non-matching filters", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: "NonExistent",
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(0);
			expect(result.rowCount).toBe(0);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("queries from different table (posts)", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
			});

			expect(result.rows.length).toBe(7);
			expect(result.rowCount).toBe(7);
			expect(result.rows[0]).toHaveProperty("user_id");
			expect(result.rows[0]).toHaveProperty("title");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters posts by published status (boolean)", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
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
			});

			// Posts with published=true: First Post, Second Post, Charlie Post, Diana Post
			expect(result.rowCount).toBe(4);
			expect(result.rows.every((row) => row.published === true)).toBe(true);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("filters by ID correctly", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "id",
							operator: "equals",
							value: 3,
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rows.length).toBe(1);
			expect(result.rows[0].id).toBe(3);
			expect(result.rows[0].name).toBe("Charlie");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("applies pagination with large dataset", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const client = yield* SqlClient.SqlClient;

			// Insert many users
			for (let i = 0; i < 100; i++) {
				yield* client`
					INSERT INTO users (name, email, age)
					VALUES (${`User ${i + 1}`}, ${`user${i + 1}@example.com`}, ${20 + (i % 40)})
				`;
			}

			// Get first page
			const page1 = yield* queryTableRows({
				schema: "public",
				table: "users",
				limit: 10,
				offset: 0,
			});

			// Get second page
			const page2 = yield* queryTableRows({
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("ignores filter conditions with null values", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
					conditions: [
						{
							column: "name",
							operator: "equals",
							value: null,
						},
					],
					logicalOperator: "and",
				},
			});

			// When filter value is null, it should be ignored and return all users
			expect(result.rows.length).toBe(5);
			expect(result.rowCount).toBe(5);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("handles mixed valid and invalid filter conditions", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "users",
				filters: {
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
				},
			});

			// Should only apply the age filter, ignoring the undefined name filter
			expect(result.rows.length).toBe(4); // Age > 25: 28, 30, 32, 35
			expect(result.rowCount).toBe(4);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect(
		"handles all filter conditions being invalid (undefined/null)",
		() =>
			Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows({
					schema: "public",
					table: "users",
					filters: {
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
					},
				});

				// When all filter values are invalid, no filters should be applied
				expect(result.rows.length).toBe(5);
				expect(result.rowCount).toBe(5);
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect(
		"returns correct row count even with filters and limit applied",
		() =>
			Effect.gen(function* () {
				yield* setupSchema;
				yield* insertTestData;

				const result = yield* queryTableRows({
					schema: "public",
					table: "users",
					limit: 2,
					filters: {
						conditions: [
							{
								column: "age",
								operator: "greater_than",
								value: 25,
							},
						],
						logicalOperator: "and",
					},
				});

				expect(result.rows.length).toBe(2); // Limited to 2 rows
				expect(result.rowCount).toBe(4); // But total count after filter is 4 (ages 28, 30, 32, 35)
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("orders and filters together correctly", () =>
		Effect.gen(function* () {
			yield* setupSchema;
			yield* insertTestData;

			const result = yield* queryTableRows({
				schema: "public",
				table: "posts",
				orderBy: "id",
				orderDirection: "desc",
				filters: {
					conditions: [
						{
							column: "user_id",
							operator: "equals",
							value: 1, // Alice's posts
						},
					],
					logicalOperator: "and",
				},
			});

			expect(result.rowCount).toBe(2); // Alice has 2 posts
			expect(result.rows[0].user_id).toBe(1);
			expect(result.rows[1].user_id).toBe(1);
			// Ordered desc, so higher id first
			expect(Number(result.rows[0].id)).toBeGreaterThan(
				Number(result.rows[1].id),
			);
		}).pipe(Effect.provide(pgliteLayer)),
	);
});
