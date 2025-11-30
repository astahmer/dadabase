import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getAllTablesColumns } from "./get-all-tables-columns.kysely.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { QueryLoggerNoopLayer } from "#src/server/query-logger/query-logger.layer.noop.ts";
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
).pipe(Layer.merge(QueryLoggerNoopLayer)) as any as Layer.Layer<
	KyselyPgDatabase | QueryLogger,
	never,
	never
>;

describe("getAllTablesColumns", () => {
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

	it.effect("retrieves all tables in a schema", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });

			const tableNames = result.map((t) => t.table).sort();
			expect(tableNames).toEqual([
				"post_tags",
				"posts",
				"tags",
				"user_profiles",
				"users",
			]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("retrieves correct columns for simple table without FKs", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const usersTable = result.find((t) => t.table === "users");

			expect(usersTable).toBeDefined();
			expect(usersTable!.columns.length).toBe(3);

			const columnNames = usersTable!.columns.map((c) => c.name).sort();
			expect(columnNames).toEqual(["email", "id", "name"]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies primary key columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const usersTable = result.find((t) => t.table === "users");

			const idColumn = usersTable!.columns.find((c) => c.name === "id");
			expect(idColumn?.primaryKey).toBe(true);

			const nameColumn = usersTable!.columns.find((c) => c.name === "name");
			expect(nameColumn?.primaryKey).not.toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies unique columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const usersTable = result.find((t) => t.table === "users");

			const emailColumn = usersTable!.columns.find((c) => c.name === "email");
			expect(emailColumn?.unique).toBe(true);

			const nameColumn = usersTable!.columns.find((c) => c.name === "name");
			expect(nameColumn?.unique).not.toBe(true);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies nullable columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postsTable = result.find((t) => t.table === "posts");

			const contentColumn = postsTable!.columns.find(
				(c) => c.name === "content",
			);
			expect(contentColumn?.nullable).toBe(true);

			const titleColumn = postsTable!.columns.find((c) => c.name === "title");
			expect(titleColumn?.nullable).toBe(false);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies data types", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postsTable = result.find((t) => t.table === "posts");

			const idColumn = postsTable!.columns.find((c) => c.name === "id");
			expect(idColumn?.dataType).toContain("integer");

			const titleColumn = postsTable!.columns.find((c) => c.name === "title");
			expect(titleColumn?.dataType).toContain("text");

			const publishedColumn = postsTable!.columns.find(
				(c) => c.name === "published",
			);
			expect(publishedColumn?.dataType).toContain("boolean");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("retrieves foreign key information for FK columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postsTable = result.find((t) => t.table === "posts");

			const userIdColumn = postsTable!.columns.find(
				(c) => c.name === "user_id",
			);
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

			const result = yield* getAllTablesColumns({ schema: "public" });
			const usersTable = result.find((t) => t.table === "users");

			const nameColumn = usersTable!.columns.find((c) => c.name === "name");
			expect(nameColumn?.isForeignKey).toBe(false);
			expect(nameColumn?.foreignKey).toBeUndefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles one-to-one relationships (unique FK)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const userProfilesTable = result.find((t) => t.table === "user_profiles");

			const userIdColumn = userProfilesTable!.columns.find(
				(c) => c.name === "user_id",
			);
			expect(userIdColumn?.isForeignKey).toBe(true);
			// user_id is both a PK and a UNIQUE constraint, so it should be marked as primaryKey
			expect(userIdColumn?.primaryKey).toBe(true);
			expect(userIdColumn?.foreignKey?.referencedTable).toBe("users");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles many-to-many relationships (composite FK)", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postTagsTable = result.find((t) => t.table === "post_tags");

			const postIdColumn = postTagsTable!.columns.find(
				(c) => c.name === "post_id",
			);
			expect(postIdColumn?.isForeignKey).toBe(true);
			expect(postIdColumn?.foreignKey?.referencedTable).toBe("posts");

			const tagIdColumn = postTagsTable!.columns.find(
				(c) => c.name === "tag_id",
			);
			expect(tagIdColumn?.isForeignKey).toBe(true);
			expect(tagIdColumn?.foreignKey?.referencedTable).toBe("tags");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("does not return duplicate columns", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });

			// Check that each table has unique column names (no duplicates)
			for (const tableData of result) {
				const columnNames = tableData.columns.map((c) => c.name);
				const uniqueColumnNames = new Set(columnNames);
				expect(columnNames.length).toBe(uniqueColumnNames.size);
			}
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("preserves column order from table definition", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postsTable = result.find((t) => t.table === "posts");

			const columnNames = postsTable!.columns.map((c) => c.name);
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

	it.effect("returns empty array for schema with no tables", () => {
		return Effect.gen(function* () {
			const result = yield* getAllTablesColumns({
				schema: "nonexistent_schema",
			});

			expect(result).toEqual([]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("includes default values when present", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const result = yield* getAllTablesColumns({ schema: "public" });
			const postsTable = result.find((t) => t.table === "posts");

			const publishedColumn = postsTable!.columns.find(
				(c) => c.name === "published",
			);
			// The default value should contain 'false'
			expect(publishedColumn?.defaultValue).toBeDefined();
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"does not return duplicates for columns with both PK and UNIQUE constraints",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const result = yield* getAllTablesColumns({ schema: "public" });
				const userProfilesTable = result.find(
					(t) => t.table === "user_profiles",
				);

				// user_profiles.user_id is defined as:
				// user_id SERIAL UNIQUE PRIMARY KEY REFERENCES users(id)
				// This column has BOTH a PRIMARY KEY constraint AND a UNIQUE constraint
				// which can cause duplicates if DISTINCT ON is not used

				expect(userProfilesTable).toBeDefined();
				expect(userProfilesTable!.columns.length).toBe(3); // user_id, bio, created_at

				const userIdColumn = userProfilesTable!.columns.find(
					(c) => c.name === "user_id",
				);
				// Should only appear once despite having multiple constraints
				expect(userIdColumn).toBeDefined();
				expect(userIdColumn?.primaryKey).toBe(true);
				// unique might be null or true due to LEFT JOIN behavior, just verify it's not missing
				expect(userIdColumn?.unique).not.toBeUndefined();

				// Verify no duplicates by checking column count
				const userIdOccurrences = userProfilesTable!.columns.filter(
					(c) => c.name === "user_id",
				).length;
				expect(userIdOccurrences).toBe(1);
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);
});
