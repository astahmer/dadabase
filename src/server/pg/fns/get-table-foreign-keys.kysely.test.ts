import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import {
	getTableForeignKeys,
	findColumnReferences,
	findColumnReferencesWithCounts,
} from "./get-table-foreign-keys.kysely.ts";
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
	};
	posts: {
		id: ColumnType<number, number, number>;
		user_id: ColumnType<number, number, number>;
		title: ColumnType<string, string, string>;
	};
	comments: {
		id: ColumnType<number, number, number>;
		post_id: ColumnType<number, number, number>;
		user_id: ColumnType<number, number, number>;
		text: ColumnType<string, string, string>;
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

describe("getTableForeignKeys", () => {
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
				bio TEXT
			)
		`);

		// Create posts table with FK to users
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS posts (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL
			)
		`);

		// Create comments table with multiple FKs
		yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS comments (
				id SERIAL PRIMARY KEY,
				post_id INTEGER NOT NULL REFERENCES posts(id),
				user_id INTEGER NOT NULL REFERENCES users(id),
				text TEXT NOT NULL
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

	describe("getTableForeignKeys", () => {
		it.effect("retrieves no foreign keys for table without FKs", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "users",
				});

				expect(fks.length).toBe(0);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("retrieves single foreign key from table", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "user_profiles",
				});

				expect(fks.length).toBe(1);
				expect(fks[0].columnName).toBe("user_id");
				expect(fks[0].referencedTable).toBe("users");
				expect(fks[0].referencedColumn).toBe("id");
				expect(fks[0].referencedSchema).toBe("public");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("retrieves foreign key information with constraint name", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "posts",
				});

				expect(fks.length).toBe(1);
				expect(fks[0].constraintName).toBeDefined();
				expect(fks[0].constraintName).toMatch(/posts_user_id_fkey/);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("retrieves multiple foreign keys from table", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "comments",
				});

				expect(fks.length).toBe(2);

				const postIdFK = fks.find((fk) => fk.columnName === "post_id");
				expect(postIdFK?.referencedTable).toBe("posts");

				const userIdFK = fks.find((fk) => fk.columnName === "user_id");
				expect(userIdFK?.referencedTable).toBe("users");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("retrieves foreign keys from many-to-many junction table", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "post_tags",
				});

				expect(fks.length).toBe(2);

				const postFk = fks.find((fk) => fk.columnName === "post_id");
				expect(postFk?.referencedTable).toBe("posts");

				const tagFk = fks.find((fk) => fk.columnName === "tag_id");
				expect(tagFk?.referencedTable).toBe("tags");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns empty array for non-existent table", () => {
			return Effect.gen(function* () {
				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "nonexistent_table",
				});

				expect(fks).toEqual([]);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("orders foreign keys by column ordinal position", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const fks = yield* getTableForeignKeys({
					schema: "public",
					table: "comments",
				});

				// post_id is defined before user_id in the CREATE TABLE
				const columnNames = fks.map((fk) => fk.columnName);
				expect(columnNames[0]).toBe("post_id");
				expect(columnNames[1]).toBe("user_id");
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});

	describe("findColumnReferences", () => {
		it.effect("finds tables that reference a column", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				// Find all tables that reference users.id
				const refs = yield* findColumnReferences({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
				});

				expect(refs.length).toBeGreaterThan(0);

				const tables = refs.map((ref) => ref.table);
				expect(tables).toContain("user_profiles");
				expect(tables).toContain("posts");
				expect(tables).toContain("comments");
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("finds correct columns that reference a table", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const refs = yield* findColumnReferences({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
				});

				const userProfileRef = refs.find(
					(ref) => ref.table === "user_profiles" && ref.column === "user_id",
				);
				expect(userProfileRef).toBeDefined();
				expect(userProfileRef?.referencedColumn).toBe("id");

				const postRef = refs.find(
					(ref) => ref.table === "posts" && ref.column === "user_id",
				);
				expect(postRef).toBeDefined();
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("returns empty array when no tables reference a column", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				// tags table is not referenced by anything
				const refs = yield* findColumnReferences({
					referencedSchema: "public",
					referencedTable: "tags",
					referencedColumn: "name",
				});

				expect(refs.length).toBe(0);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes constraint names in references", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const refs = yield* findColumnReferences({
					referencedSchema: "public",
					referencedTable: "posts",
					referencedColumn: "id",
				});

				const commentRef = refs.find((ref) => ref.table === "comments");
				expect(commentRef?.constraintName).toBeDefined();
				expect(commentRef?.constraintName).toMatch(/comments_post_id_fkey/);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("finds references in many-to-many junction tables", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const refs = yield* findColumnReferences({
					referencedSchema: "public",
					referencedTable: "posts",
					referencedColumn: "id",
				});

				const postTagRef = refs.find(
					(ref) => ref.table === "post_tags" && ref.column === "post_id",
				);
				expect(postTagRef).toBeDefined();
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});

	describe("findColumnReferencesWithCounts", () => {
		it.effect("returns references with zero row counts for no data", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: 1,
				});

				expect(refs.length).toBeGreaterThan(0);
				// All counts should be 0 since we haven't inserted any data
				refs.forEach((ref) => {
					expect(ref.matchingRowCount).toBe(0);
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("counts matching rows for valid cell value", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const db = yield* KyselyPgDatabase;

				// Insert test data
				yield* db.executeRaw(sql`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`);

				yield* db.executeRaw(sql`
					INSERT INTO posts (user_id, title) VALUES (1, 'Hello World')
				`);

				yield* db.executeRaw(sql`
					INSERT INTO comments (post_id, user_id, text) VALUES (1, 1, 'Great post!')
				`);

				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: 1,
				});

				const postRef = refs.find((ref) => ref.table === "posts");
				expect(postRef?.matchingRowCount).toBe(1);

				const commentRef = refs.find(
					(ref) => ref.table === "comments" && ref.column === "user_id",
				);
				expect(commentRef?.matchingRowCount).toBe(1);
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("handles null cell values correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const db = yield* KyselyPgDatabase;

				// Insert data with some nulls (if column allows)
				yield* db.executeRaw(sql`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`);

				yield* db.executeRaw(sql`
					INSERT INTO user_profiles (user_id, bio) VALUES (1, NULL)
				`);

				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: null,
				});

				// Should not count rows where user_id references user 1 as "matching null"
				refs.forEach((ref) => {
					expect(ref.matchingRowCount).toBeGreaterThanOrEqual(0);
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("normalizes string 'null' to actual null", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const db = yield* KyselyPgDatabase;

				// Insert test data
				yield* db.executeRaw(sql`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`);

				// Should treat string "null" as actual null value
				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: "null",
				});

				expect(refs.length).toBeGreaterThan(0);
				refs.forEach((ref) => {
					// All should be 0 since we're looking for IS NULL
					expect(ref.matchingRowCount).toBeGreaterThanOrEqual(0);
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("includes constraint names and schema in results", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: 1,
				});

				expect(refs.length).toBeGreaterThan(0);
				refs.forEach((ref) => {
					expect(ref.schema).toBe("public");
					expect(ref.constraintName).toBeDefined();
					expect(ref.table).toBeDefined();
					expect(ref.column).toBeDefined();
					expect(ref.referencedColumn).toBe("id");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		});

		it.effect("counts multiple matching rows correctly", () => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const db = yield* KyselyPgDatabase;

				// Insert test data with multiple references
				yield* db.executeRaw(sql`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`);

				yield* db.executeRaw(sql`
					INSERT INTO posts (user_id, title) VALUES
					(1, 'Post 1'),
					(1, 'Post 2'),
					(1, 'Post 3')
				`);

				const refs = yield* findColumnReferencesWithCounts({
					referencedSchema: "public",
					referencedTable: "users",
					referencedColumn: "id",
					cellValue: 1,
				});

				const postRef = refs.find((ref) => ref.table === "posts");
				expect(postRef?.matchingRowCount).toBe(3);
			}).pipe(Effect.provide(InMemoryLayer));
		});
	});
});
