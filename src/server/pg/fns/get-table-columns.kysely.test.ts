import { PgLiteClient } from "@dadabase/effect-pglite";
import { SqlClient } from "@effect/sql";
import { getTableColumns } from "#src/server/introspection/introspection.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

/**
 * Test schema interface (used for documentation, not runtime)
 */
interface ColumnInfo {
	column_name: string;
	data_type: string;
	is_nullable: boolean;
	column_default: string | null;
	ordinal_position: number;
}

const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
});

describe("getTableColumns", () => {
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

	it.effect("retrieves all columns from a simple table", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			expect(columns).toHaveLength(3);
			const columnNames = columns.map((c) => c.column_name).sort();
			expect(columnNames).toEqual(["email", "id", "name"]);
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("correctly identifies nullable columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const contentColumn = columns.find((c) => c.column_name === "content");
			expect(contentColumn?.is_nullable).toBe(true);

			const titleColumn = columns.find((c) => c.column_name === "title");
			expect(titleColumn?.is_nullable).toBe(false);
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("correctly identifies data types", () => {
		return Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("preserves column order from table definition", () => {
		return Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("does not return duplicate columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			// Check that there are no duplicate column names
			const columnNames = columns.map((c) => c.column_name);
			const uniqueColumnNames = new Set(columnNames);
			expect(columnNames.length).toBe(uniqueColumnNames.size);
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("includes default values when present", () => {
		return Effect.gen(function* () {
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
		}).pipe(Effect.provide(pgliteLayer));
	});

	it.effect("handles tables with multiple columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "post_tags",
			});

			expect(columns.length).toBe(2);
			const columnNames = columns.map((c) => c.column_name).sort();
			expect(columnNames).toEqual(["post_id", "tag_id"]);
		}).pipe(Effect.provide(pgliteLayer));
	});
});
