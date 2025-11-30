import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { getTableRelationships } from "./get-table-relationships.kysely.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.service.ts";
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
).pipe(Layer.merge(QueryLogger.Default)) as any as Layer.Layer<
	KyselyPgDatabase | QueryLogger,
	never,
	never
>;

describe("getTableRelationships", () => {
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

	it.effect(
		"returns relationships for tables referenced in junction tables",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				// tags is referenced by post_tags junction table
				const relationships = yield* getTableRelationships({
					schema: "public",
					table: "tags",
				});

				// Should have incoming relationship from post_tags
				expect(relationships.length).toBeGreaterThan(0);
				const incomingFromJunction = relationships.find(
					(r) => r.type === "incoming" && r.referencingTable === "post_tags",
				);
				expect(incomingFromJunction).toBeDefined();
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("retrieves outgoing and incoming relationships for posts", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			// posts has 1 outgoing FK to users and 2 incoming FKs (from comments and post_tags)
			expect(relationships.length).toBe(3);

			const outgoing = relationships.filter((r) => r.type === "outgoing");
			expect(outgoing.length).toBe(1);
			expect(outgoing[0].referencingTable).toBe("posts");
			expect(outgoing[0].referencingColumn).toBe("user_id");
			expect(outgoing[0].referencedTable).toBe("users");

			const incoming = relationships.filter((r) => r.type === "incoming");
			expect(incoming.length).toBe(2);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"retrieves only incoming relationships for table being referenced",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: "public",
					table: "users",
				});

				// users has incoming FKs from posts, user_profiles, and comments
				const incomingRels = relationships.filter((r) => r.type === "incoming");
				expect(incomingRels.length).toBeGreaterThan(0);

				// All should be incoming
				relationships.forEach((rel) => {
					expect(rel.type).toBe("incoming");
					expect(rel.referencedTable).toBe("users");
					expect(rel.referencedColumn).toBe("id");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("retrieves both incoming and outgoing relationships", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			// posts has outgoing FK to users and incoming FKs from comments and post_tags
			const outgoing = relationships.filter((r) => r.type === "outgoing");
			const incoming = relationships.filter((r) => r.type === "incoming");

			expect(outgoing.length).toBeGreaterThan(0);
			expect(incoming.length).toBeGreaterThan(0);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"includes correct schema information for outgoing relationships",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: "public",
					table: "posts",
				});

				const outgoing = relationships.find((r) => r.type === "outgoing");

				expect(outgoing?.referencingSchema).toBe("public");
				expect(outgoing?.referencingTable).toBe("posts");
				expect(outgoing?.referencedSchema).toBe("public");
				expect(outgoing?.referencedTable).toBe("users");
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect(
		"includes correct schema information for incoming relationships",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: "public",
					table: "users",
				});

				relationships.forEach((rel) => {
					expect(rel.type).toBe("incoming");
					expect(rel.referencedSchema).toBe("public");
					expect(rel.referencedTable).toBe("users");
					expect(rel.referencingSchema).toBe("public");
				});
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("includes constraint names for all relationships", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			relationships.forEach((rel) => {
				expect(rel.constraintName).toBeDefined();
				expect(rel.constraintName.length).toBeGreaterThan(0);
			});
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles table with multiple outgoing FKs", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "comments",
			});

			// comments has outgoing FKs to posts and users
			const outgoing = relationships.filter((r) => r.type === "outgoing");
			expect(outgoing.length).toBe(2);

			const postFk = outgoing.find((r) => r.referencingColumn === "post_id");
			expect(postFk?.referencedTable).toBe("posts");

			const userFk = outgoing.find((r) => r.referencingColumn === "user_id");
			expect(userFk?.referencedTable).toBe("users");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("handles one-to-one relationships", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "user_profiles",
			});

			// user_profiles has one outgoing FK to users (one-to-one)
			expect(relationships.length).toBe(1);
			expect(relationships[0].type).toBe("outgoing");
			expect(relationships[0].referencingColumn).toBe("user_id");
			expect(relationships[0].referencedTable).toBe("users");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect(
		"handles many-to-many relationships through junction tables",
		() => {
			return Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: "public",
					table: "post_tags",
				});

				// post_tags has outgoing FKs to posts and tags
				const outgoing = relationships.filter((r) => r.type === "outgoing");
				expect(outgoing.length).toBe(2);

				const postFk = outgoing.find((r) => r.referencingColumn === "post_id");
				expect(postFk?.referencedTable).toBe("posts");

				const tagFk = outgoing.find((r) => r.referencingColumn === "tag_id");
				expect(tagFk?.referencedTable).toBe("tags");
			}).pipe(Effect.provide(InMemoryLayer));
		},
	);

	it.effect("identifies junction table relationships correctly", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			// From posts perspective: incoming relationship from post_tags
			const postRelationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			const incomingFromJunction = postRelationships.find(
				(r) => r.type === "incoming" && r.referencingTable === "post_tags",
			);
			expect(incomingFromJunction).toBeDefined();
			expect(incomingFromJunction?.referencingColumn).toBe("post_id");

			// From tags perspective: incoming relationship from post_tags
			const tagRelationships = yield* getTableRelationships({
				schema: "public",
				table: "tags",
			});

			const incomingFromJunctionToTags = tagRelationships.find(
				(r) => r.type === "incoming" && r.referencingTable === "post_tags",
			);
			expect(incomingFromJunctionToTags).toBeDefined();
			expect(incomingFromJunctionToTags?.referencingColumn).toBe("tag_id");
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("orders results consistently", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			// Should be ordered by type, then referencingTable, then referencingColumn
			// Outgoing comes first alphabetically, then incoming
			if (relationships.length > 1) {
				for (let i = 0; i < relationships.length - 1; i++) {
					const current = relationships[i];
					const next = relationships[i + 1];

					// Check ordering by type first
					if (current.type === next.type) {
						// Same type, check table name
						expect(
							current.referencingTable.localeCompare(next.referencingTable),
						).toBeLessThanOrEqual(0);
					}
				}
			}
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("returns empty array for non-existent table", () => {
		return Effect.gen(function* () {
			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "nonexistent_table",
			});

			expect(relationships).toEqual([]);
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("specifies correct relationship types", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			relationships.forEach((rel) => {
				expect(["outgoing", "incoming"]).toContain(rel.type);

				if (rel.type === "outgoing") {
					// For outgoing, referencing table should be posts
					expect(rel.referencingTable).toBe("posts");
				} else if (rel.type === "incoming") {
					// For incoming, referenced table should be posts
					expect(rel.referencedTable).toBe("posts");
				}
			});
		}).pipe(Effect.provide(InMemoryLayer));
	});

	it.effect("correctly identifies foreign key columns vs primary keys", () => {
		return Effect.gen(function* () {
			yield* setupSchema;

			const relationships = yield* getTableRelationships({
				schema: "public",
				table: "posts",
			});

			// Outgoing relationships should have FK columns
			const outgoing = relationships.find((r) => r.type === "outgoing");
			expect(outgoing?.referencingColumn).toBe("user_id");

			// Incoming relationships should reference PK/unique columns
			const incoming = relationships.filter((r) => r.type === "incoming");
			incoming.forEach((rel) => {
				expect(rel.referencedColumn).toBe("id");
			});
		}).pipe(Effect.provide(InMemoryLayer));
	});
});
