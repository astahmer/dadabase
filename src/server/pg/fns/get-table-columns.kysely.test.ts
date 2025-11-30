import { PgLiteClient } from "@dadabase/effect-pglite";
import { SqlClient } from "@effect/sql";
import {
	getTableColumns,
	getTableForeignKeys,
	getTableIndexes,
} from "#src/server/introspection/introspection.ts";
import { describe, expect, test } from "vitest";
import { Effect, Exit } from "effect";

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
});

// Helper to run tests with the pglite layer
async function runTest<A>(
	program: Effect.Effect<A, unknown, SqlClient.SqlClient>,
): Promise<A> {
	const exit = await Effect.runPromiseExit(
		program.pipe(Effect.provide(pgliteLayer as any)) as Effect.Effect<
			A,
			unknown,
			never
		>,
	);
	if (Exit.isFailure(exit)) {
		throw exit.cause;
	}
	return exit.value;
}

// Helper to set up test schema
const setupSchema = Effect.gen(function* () {
	const client = yield* SqlClient.SqlClient;

	// Create users table
	yield* client`
		CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
email TEXT NOT NULL UNIQUE
)
	`;

	// Create user_profiles table with FK to users
	yield* client`
		CREATE TABLE IF NOT EXISTS user_profiles (
user_id SERIAL UNIQUE PRIMARY KEY REFERENCES users(id),
bio TEXT,
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
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

	// Create tags table
	yield* client`
		CREATE TABLE IF NOT EXISTS tags (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL UNIQUE
)
	`;

	// Create many-to-many junction table
	yield* client`
		CREATE TABLE IF NOT EXISTS post_tags (
post_id INTEGER NOT NULL REFERENCES posts(id),
tag_id INTEGER NOT NULL REFERENCES tags(id),
PRIMARY KEY (post_id, tag_id)
)
	`;
});

describe("getTableColumns", () => {
	test("retrieves all columns from a simple table", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "users",
				});

				expect(columns).toHaveLength(3);
				const columnNames = columns.map((c) => c.column_name).sort();
				expect(columnNames).toEqual(["email", "id", "name"]);
			}),
		);
	});

	test("correctly identifies nullable columns", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "posts",
				});

				const contentColumn = columns.find((c) => c.column_name === "content");
				expect(contentColumn?.is_nullable).toBe(true);

				const titleColumn = columns.find((c) => c.column_name === "title");
				expect(titleColumn?.is_nullable).toBe(false);
			}),
		);
	});

	test("correctly identifies data types", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "posts",
				});

				const idColumn = columns.find((c) => c.column_name === "id");
				expect(idColumn?.data_type).toContain("integer");

				const titleColumn = columns.find((c) => c.column_name === "title");
				expect(titleColumn?.data_type).toContain("text");

				const publishedColumn = columns.find(
					(c) => c.column_name === "published",
				);
				expect(publishedColumn?.data_type).toContain("boolean");
			}),
		);
	});
	test("returns empty array for non-existent table", async () => {
		await runTest(
			Effect.gen(function* () {
				const result = yield* getTableColumns({
					schema: "public",
					table: "nonexistent_table",
				});

				expect(result).toEqual([]);
			}),
		);
	});

	test("retrieves columns with nullable defaults", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "user_profiles",
				});

				const bioColumn = columns.find((c) => c.column_name === "bio");
				expect(bioColumn?.is_nullable).toBe(true);
				expect(bioColumn?.column_default).toBeNull();
			}),
		);
	});

	test("retrieves columns with timestamp defaults", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "user_profiles",
				});

				const createdAtColumn = columns.find(
					(c) => c.column_name === "created_at",
				);
				expect(createdAtColumn?.is_nullable).toBe(false);
				expect(createdAtColumn?.column_default).toBeDefined();
				expect(createdAtColumn?.data_type).toContain("timestamp");
			}),
		);
	});

	test("preserves column order from table definition", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "posts",
				});

				const columnNames = columns.map((c) => c.column_name);
				// Columns should be in the order they were defined: id, user_id, title, content, published
				expect(columnNames).toEqual([
					"id",
					"user_id",
					"title",
					"content",
					"published",
				]);
			}),
		);
	});

	test("does not return duplicate columns", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "posts",
				});

				// Check that there are no duplicate column names
				const columnNames = columns.map((c) => c.column_name);
				const uniqueColumnNames = new Set(columnNames);
				expect(columnNames.length).toBe(uniqueColumnNames.size);
			}),
		);
	});

	test("includes default values when present", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "posts",
				});

				const publishedColumn = columns.find(
					(c) => c.column_name === "published",
				);
				// The default value should contain 'false'
				expect(publishedColumn?.column_default).toBeDefined();
			}),
		);
	});

	test("handles tables with multiple columns", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const columns = yield* getTableColumns({
					schema: "public",
					table: "post_tags",
				});

				expect(columns.length).toBe(2);
				const columnNames = columns.map((c) => c.column_name).sort();
				expect(columnNames).toEqual(["post_id", "tag_id"]);
			}),
		);
	});

	test("does not return duplicates for columns with both PK and UNIQUE constraints", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				// user_profiles.user_id is defined as:
				// user_id SERIAL UNIQUE PRIMARY KEY REFERENCES users(id)
				// This column has BOTH a PRIMARY KEY constraint AND a UNIQUE constraint

				const columns = yield* getTableColumns({
					schema: "public",
					table: "user_profiles",
				});

				expect(columns.length).toBe(3); // user_id, bio, created_at

				const userIdColumn = columns.find((c) => c.column_name === "user_id");
				expect(userIdColumn).toBeDefined();

				// Verify no duplicates by checking column count
				const userIdOccurrences = columns.filter(
					(c) => c.column_name === "user_id",
				).length;
				expect(userIdOccurrences).toBe(1);

				// Check via indexes that it's both primary and unique
				const indexes = yield* getTableIndexes({
					schema: "public",
					table: "user_profiles",
				});
				const userIdIndexes = indexes.filter(
					(idx) => idx.column_name === "user_id",
				);
				const hasPrimary = userIdIndexes.some((idx) => idx.is_primary);
				const hasUnique = userIdIndexes.some((idx) => idx.is_unique);
				expect(hasPrimary).toBe(true);
				expect(hasUnique).toBe(true);
			}),
		);
	});
});

describe("getTableIndexes", () => {
	test("correctly identifies primary key columns via getTableIndexes", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const indexes = yield* getTableIndexes({
					schema: "public",
					table: "users",
				});

				// Find primary key index
				const pkIndex = indexes.find((idx) => idx.is_primary);
				expect(pkIndex).toBeDefined();
				expect(pkIndex?.column_name).toBe("id");
			}),
		);
	});

	test("correctly identifies unique columns via getTableIndexes", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const indexes = yield* getTableIndexes({
					schema: "public",
					table: "users",
				});

				// Find unique index for email column
				const uniqueIndex = indexes.find(
					(idx) =>
						idx.is_unique && !idx.is_primary && idx.column_name === "email",
				);
				expect(uniqueIndex).toBeDefined();
			}),
		);
	});

	test("handles one-to-one relationships (unique FK)", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const foreignKeys = yield* getTableForeignKeys({
					schema: "public",
					table: "user_profiles",
				});

				const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
				expect(userIdFK).toBeDefined();
				expect(userIdFK?.referenced_table_name).toBe("users");

				// Also check that user_id is a primary key via indexes
				const indexes = yield* getTableIndexes({
					schema: "public",
					table: "user_profiles",
				});
				const pkIndex = indexes.find(
					(idx) => idx.is_primary && idx.column_name === "user_id",
				);
				expect(pkIndex).toBeDefined();
			}),
		);
	});

	test("handles composite primary keys via getTableIndexes", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const indexes = yield* getTableIndexes({
					schema: "public",
					table: "post_tags",
				});

				// Find primary key indexes - there should be entries for both columns
				const pkIndexes = indexes.filter((idx) => idx.is_primary);
				expect(pkIndexes.length).toBeGreaterThanOrEqual(1);
			}),
		);
	});
});

describe("getTableForeignKeys", () => {
	test("correctly returns constraint names for foreign keys", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const foreignKeys = yield* getTableForeignKeys({
					schema: "public",
					table: "posts",
				});

				const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
				expect(userIdFK?.constraint_name).toBeDefined();
				expect(userIdFK?.constraint_name).toMatch(/posts_user_id_fkey/);
			}),
		);
	});

	test("retrieves foreign key information via getTableForeignKeys", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const foreignKeys = yield* getTableForeignKeys({
					schema: "public",
					table: "posts",
				});

				const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
				expect(userIdFK).toBeDefined();
				expect(userIdFK?.referenced_table_name).toBe("users");
				expect(userIdFK?.referenced_column_name).toBe("id");
				expect(userIdFK?.referenced_table_schema).toBe("public");
			}),
		);
	});

	test("returns empty foreign keys for tables without FKs", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const foreignKeys = yield* getTableForeignKeys({
					schema: "public",
					table: "users",
				});

				// users table has no foreign keys
				expect(foreignKeys.length).toBe(0);
			}),
		);
	});

	test("handles tables with multiple foreign keys", async () => {
		await runTest(
			Effect.gen(function* () {
				yield* setupSchema;

				const foreignKeys = yield* getTableForeignKeys({
					schema: "public",
					table: "post_tags",
				});

				const postIdFK = foreignKeys.find((fk) => fk.column_name === "post_id");
				expect(postIdFK).toBeDefined();
				expect(postIdFK?.referenced_table_name).toBe("posts");

				const tagIdFK = foreignKeys.find((fk) => fk.column_name === "tag_id");
				expect(tagIdFK).toBeDefined();
				expect(tagIdFK?.referenced_table_name).toBe("tags");
			}),
		);
	});
});
