import { PgLiteClient } from "@dadabase/effect-pglite";
import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import {
	getTableColumns,
	getTableForeignKeys,
	getTableIndexes,
} from "#src/server/introspection/introspection.ts";
import { Effect, Layer } from "effect";

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

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
	it.effect("retrieves all columns from a simple table", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			expect(columns).toHaveLength(3);
			const columnNames = columns.map((c) => c.name).sort();
			expect(columnNames).toEqual(["email", "id", "name"]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("correctly identifies nullable columns", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const contentColumn = columns.find((c) => c.name === "content");
			expect(contentColumn?.nullable).toBe(true);

			const titleColumn = columns.find((c) => c.name === "title");
			expect(titleColumn?.nullable).toBe(false);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("correctly identifies data types", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const idColumn = columns.find((c) => c.name === "id");
			expect(idColumn?.dataType).toContain("integer");

			const titleColumn = columns.find((c) => c.name === "title");
			expect(titleColumn?.dataType).toContain("text");

			const publishedColumn = columns.find((c) => c.name === "published");
			expect(publishedColumn?.dataType).toContain("boolean");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns empty array for non-existent table", () =>
		Effect.gen(function* () {
			const result = yield* getTableColumns({
				schema: "public",
				table: "nonexistent_table",
			});

			expect(result).toEqual([]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("retrieves columns with nullable defaults", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "user_profiles",
			});

			const bioColumn = columns.find((c) => c.name === "bio");
			expect(bioColumn?.nullable).toBe(true);
			expect(bioColumn?.defaultValue).toBeNull();
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("retrieves columns with timestamp defaults", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "user_profiles",
			});

			const createdAtColumn = columns.find((c) => c.name === "created_at");
			expect(createdAtColumn?.nullable).toBe(false);
			expect(createdAtColumn?.defaultValue).toBeDefined();
			expect(createdAtColumn?.dataType).toContain("timestamp");
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("preserves column order from table definition", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const columnNames = columns.map((c) => c.name);
			// Columns should be in the order they were defined: id, user_id, title, content, published
			expect(columnNames).toEqual([
				"id",
				"user_id",
				"title",
				"content",
				"published",
			]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("does not return duplicate columns", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			// Check that there are no duplicate column names
			const columnNames = columns.map((c) => c.name);
			const uniqueColumnNames = new Set(columnNames);
			expect(columnNames.length).toBe(uniqueColumnNames.size);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("includes default values when present", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const publishedColumn = columns.find((c) => c.name === "published");
			// The default value should contain 'false'
			expect(publishedColumn?.defaultValue).toBeDefined();
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("handles tables with multiple columns", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "post_tags",
			});

			expect(columns.length).toBe(2);
			const columnNames = columns.map((c) => c.name).sort();
			expect(columnNames).toEqual(["post_id", "tag_id"]);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect(
		"does not return duplicates for columns with both PK and UNIQUE constraints",
		() =>
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

				const userIdColumn = columns.find((c) => c.name === "user_id");
				expect(userIdColumn).toBeDefined();

				// Verify no duplicates by checking column count
				const userIdOccurrences = columns.filter(
					(c) => c.name === "user_id",
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
			}).pipe(Effect.provide(pgliteLayer)),
	);
});

describe("getTableIndexes", () => {
	it.effect(
		"correctly identifies primary key columns via getTableIndexes",
		() =>
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
			}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("correctly identifies unique columns via getTableIndexes", () =>
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("handles one-to-one relationships (unique FK)", () =>
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("handles composite primary keys via getTableIndexes", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const indexes = yield* getTableIndexes({
				schema: "public",
				table: "post_tags",
			});

			// Find primary key indexes - there should be entries for both columns
			const pkIndexes = indexes.filter((idx) => idx.is_primary);
			expect(pkIndexes.length).toBeGreaterThanOrEqual(1);
		}).pipe(Effect.provide(pgliteLayer)),
	);
});

describe("getTableForeignKeys", () => {
	it.effect("correctly returns constraint names for foreign keys", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const foreignKeys = yield* getTableForeignKeys({
				schema: "public",
				table: "posts",
			});

			const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
			expect(userIdFK?.constraint_name).toBeDefined();
			expect(userIdFK?.constraint_name).toMatch(/posts_user_id_fkey/);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("retrieves foreign key information via getTableForeignKeys", () =>
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
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("returns empty foreign keys for tables without FKs", () =>
		Effect.gen(function* () {
			yield* setupSchema;

			const foreignKeys = yield* getTableForeignKeys({
				schema: "public",
				table: "users",
			});

			// users table has no foreign keys
			expect(foreignKeys.length).toBe(0);
		}).pipe(Effect.provide(pgliteLayer)),
	);

	it.effect("handles tables with multiple foreign keys", () =>
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
		}).pipe(Effect.provide(pgliteLayer)),
	);
});
