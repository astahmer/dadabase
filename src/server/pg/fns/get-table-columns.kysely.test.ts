import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getTableColumns } from "./get-table-columns.kysely.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql, type ColumnType } from "kysely";

interface TestInMemoryDbSchema {
	users: {
		id: ColumnType<number, number, number>;
		name: ColumnType<string, string, string>;
		email: ColumnType<string, string, string>;
	};
	user_profiles: {
		user_id: ColumnType<number, number, number>;
		bio: ColumnType<string | null, string, string>;
		created_at: ColumnType<Date, Date, Date>;
	};
	posts: {
		id: ColumnType<number, number, number>;
		user_id: ColumnType<number, number, number>;
		title: ColumnType<string, string, string>;
		content: ColumnType<string | null, string, string>;
		published: ColumnType<boolean, boolean, boolean>;
	};
	tags: {
		id: ColumnType<number, number, number>;
		name: ColumnType<string, string, string>;
	};
	post_tags: {
		post_id: ColumnType<number, number, number>;
		tag_id: ColumnType<number, number, number>;
	};
}

const InMemoryLayer = Layer.effect(
	KyselyPgDatabase,
	makeEffectKyselyPglite<TestInMemoryDbSchema>({
		dataDir: "memory://",
	}) as any,
) as any as Layer.Layer<KyselyPgDatabase, never, never>;

describe("getTableColumns", () => {
	// Helper to set up test schema
	const setupSchema = Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		// Create users table
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS users (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE
			)
		`);

		// Create user_profiles table with FK to users
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS user_profiles (
				user_id SERIAL UNIQUE PRIMARY KEY REFERENCES users(id),
				bio TEXT,
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Create posts table with FK to users
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS posts (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL,
				content TEXT,
				published BOOLEAN NOT NULL DEFAULT false
			)
		`);

		// Create tags table
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS tags (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL UNIQUE
			)
		`);

		// Create many-to-many junction table
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS post_tags (
				post_id INTEGER NOT NULL REFERENCES posts(id),
				tag_id INTEGER NOT NULL REFERENCES tags(id),
				PRIMARY KEY (post_id, tag_id)
			)
		`);
	});

	it.effect("retrieves all columns from a simple table", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			expect(columns.length).toBe(3);
			const columnNames = columns.map((c) => c.name).sort();
			expect(columnNames).toEqual(["email", "id", "name"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies primary key columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			const idColumn = columns.find((c) => c.name === "id");
			expect(idColumn?.primaryKey).toBe(true);

			const nameColumn = columns.find((c) => c.name === "name");
			expect(nameColumn?.primaryKey).not.toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies unique columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			const emailColumn = columns.find((c) => c.name === "email");
			expect(emailColumn?.unique).toBe(true);

			const nameColumn = columns.find((c) => c.name === "name");
			expect(nameColumn?.unique).not.toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies nullable columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const contentColumn = columns.find((c) => c.name === "content");
			expect(contentColumn?.nullable).toBe(true);

			const titleColumn = columns.find((c) => c.name === "title");
			expect(titleColumn?.nullable).toBe(false);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies data types", () => {
		return Effect.gen(function* () {
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
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("retrieves foreign key information for FK columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const userIdColumn = columns.find((c) => c.name === "user_id");
			expect(userIdColumn?.isForeignKey).toBe(true);
			expect(userIdColumn?.foreignKey).toBeDefined();
			expect(userIdColumn?.foreignKey?.referencedTable).toBe("users");
			expect(userIdColumn?.foreignKey?.referencedColumn).toBe("id");
			expect(userIdColumn?.foreignKey?.referencedSchema).toBe("public");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("does not mark non-FK columns as foreign keys", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "users",
			});

			const nameColumn = columns.find((c) => c.name === "name");
			expect(nameColumn?.isForeignKey).toBe(false);
			expect(nameColumn?.foreignKey).toBeUndefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles one-to-one relationships (unique FK)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "user_profiles",
			});

			const userIdColumn = columns.find((c) => c.name === "user_id");
			expect(userIdColumn?.isForeignKey).toBe(true);
			// user_id is both a PK and a UNIQUE constraint
			expect(userIdColumn?.primaryKey).toBe(true);
			expect(userIdColumn?.foreignKey?.referencedTable).toBe("users");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("preserves column order from table definition", () => {
		return Effect.gen(function* () {
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
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("does not return duplicate columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			// Check that there are no duplicate column names
			const columnNames = columns.map((c) => c.name);
			const uniqueColumnNames = new Set(columnNames);
			expect(columnNames.length).toBe(uniqueColumnNames.size);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("includes default values when present", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const publishedColumn = columns.find((c) => c.name === "published");
			// The default value should contain 'false'
			expect(publishedColumn?.defaultValue).toBeDefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles tables with multiple foreign keys", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "post_tags",
			});

			const postIdColumn = columns.find((c) => c.name === "post_id");
			expect(postIdColumn?.isForeignKey).toBe(true);
			expect(postIdColumn?.foreignKey?.referencedTable).toBe("posts");

			const tagIdColumn = columns.find((c) => c.name === "tag_id");
			expect(tagIdColumn?.isForeignKey).toBe(true);
			expect(tagIdColumn?.foreignKey?.referencedTable).toBe("tags");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles composite primary keys", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "post_tags",
			});

			const postIdColumn = columns.find((c) => c.name === "post_id");
			expect(postIdColumn?.primaryKey).toBe(true);

			const tagIdColumn = columns.find((c) => c.name === "tag_id");
			expect(tagIdColumn?.primaryKey).toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns empty array for non-existent table", () => {
		return Effect.gen(function* () {
			const result = yield* getTableColumns({
				schema: "public",
				table: "nonexistent_table",
			});

			expect(result).toEqual([]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("retrieves columns with nullable defaults", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "user_profiles",
			});

			const bioColumn = columns.find((c) => c.name === "bio");
			expect(bioColumn?.nullable).toBe(true);
			expect(bioColumn?.defaultValue).toBeNull();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("retrieves columns with timestamp defaults", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "user_profiles",
			});

			const createdAtColumn = columns.find((c) => c.name === "created_at");
			expect(createdAtColumn?.nullable).toBe(false);
			expect(createdAtColumn?.defaultValue).toBeDefined();
			expect(createdAtColumn?.dataType).toContain("timestamp");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly returns constraint names for foreign keys", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const columns = yield* getTableColumns({
				schema: "public",
				table: "posts",
			});

			const userIdColumn = columns.find((c) => c.name === "user_id");
			expect(userIdColumn?.foreignKey?.constraintName).toBeDefined();
			expect(userIdColumn?.foreignKey?.constraintName).toMatch(
				/posts_user_id_fkey/,
			);
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
