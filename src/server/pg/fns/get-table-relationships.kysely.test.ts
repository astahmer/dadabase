import { PgLiteClient } from "@dadabase/effect-pglite";
import { LibsqlClient } from "@effect/sql-libsql";
import { getTableRelationships } from "#src/server/introspection/introspection.ts";
import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

interface TestConfig {
	defaultSchema: string;
	isPostgres: boolean;
}

const postgresConfig: TestConfig = {
	defaultSchema: "public",
	isPostgres: true,
};

const sqliteConfig: TestConfig = {
	defaultSchema: "main",
	isPostgres: false,
};

// PgLite layer for introspection tests
const pgliteLayer = PgLiteClient.layer({
	dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

// LibSQL layer for SQLite introspection tests
const libsqlLayer = LibsqlClient.layer({
	url: ":memory:",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

// Setup schema for PgLite/SqlClient tests
const createSetupSchema = (config: TestConfig) =>
	Effect.gen(function* () {
		const client = yield* SqlClient.SqlClient;

		if (config.isPostgres) {
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
					bio TEXT
				)
			`;

			// Create posts table with FK to users
			yield* client`
				CREATE TABLE IF NOT EXISTS posts (
					id SERIAL PRIMARY KEY,
					user_id INTEGER NOT NULL REFERENCES users(id),
					title TEXT NOT NULL
				)
			`;

			// Create comments table with multiple FKs
			yield* client`
				CREATE TABLE IF NOT EXISTS comments (
					id SERIAL PRIMARY KEY,
					post_id INTEGER NOT NULL REFERENCES posts(id),
					user_id INTEGER NOT NULL REFERENCES users(id),
					text TEXT NOT NULL
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
		} else {
			// Create users table
			yield* client`
				CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL,
					email TEXT NOT NULL UNIQUE
				)
			`;

			// Create user_profiles table with FK to users
			yield* client`
				CREATE TABLE IF NOT EXISTS user_profiles (
					user_id INTEGER UNIQUE PRIMARY KEY REFERENCES users(id),
					bio TEXT
				)
			`;

			// Create posts table with FK to users
			yield* client`
				CREATE TABLE IF NOT EXISTS posts (
					id INTEGER PRIMARY KEY,
					user_id INTEGER NOT NULL REFERENCES users(id),
					title TEXT NOT NULL
				)
			`;

			// Create comments table with multiple FKs
			yield* client`
				CREATE TABLE IF NOT EXISTS comments (
					id INTEGER PRIMARY KEY,
					post_id INTEGER NOT NULL REFERENCES posts(id),
					user_id INTEGER NOT NULL REFERENCES users(id),
					text TEXT NOT NULL
				)
			`;

			// Create tags table
			yield* client`
				CREATE TABLE IF NOT EXISTS tags (
					id INTEGER PRIMARY KEY,
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
		}
	});

const testSuite = (layer: Layer.Layer<SqlClient.SqlClient>, config: TestConfig) => {
	const setupSchema = createSetupSchema(config);

	return [
		it.effect(
			"returns relationships for tables referenced in junction tables",
			() =>
				Effect.gen(function* () {
					yield* setupSchema;

					// tags is referenced by post_tags junction table
					const relationships = yield* getTableRelationships({
						schema: config.defaultSchema,
						table: "tags",
					});

					// Should have incoming relationship from post_tags
					expect(relationships.length).toBeGreaterThan(0);
					const incomingFromJunction = relationships.find(
						(r) => r.type === "incoming" && r.referencingTable === "post_tags",
					);
					expect(incomingFromJunction).toBeDefined();
				}).pipe(Effect.provide(layer)),
		),

		it.effect("retrieves outgoing and incoming relationships for posts", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
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
			}).pipe(Effect.provide(layer)),
		),

		it.effect(
			"retrieves only incoming relationships for table being referenced",
			() =>
				Effect.gen(function* () {
					yield* setupSchema;

					const relationships = yield* getTableRelationships({
						schema: config.defaultSchema,
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
				}).pipe(Effect.provide(layer)),
		),

		it.effect("retrieves both incoming and outgoing relationships", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "posts",
				});

				// posts has outgoing FK to users and incoming FKs from comments and post_tags
				const outgoing = relationships.filter((r) => r.type === "outgoing");
				const incoming = relationships.filter((r) => r.type === "incoming");

				expect(outgoing.length).toBeGreaterThan(0);
				expect(incoming.length).toBeGreaterThan(0);
			}).pipe(Effect.provide(layer)),
		),

		it.effect(
			"includes correct schema information for outgoing relationships",
			() =>
				Effect.gen(function* () {
					yield* setupSchema;

					const relationships = yield* getTableRelationships({
						schema: config.defaultSchema,
						table: "posts",
					});

					const outgoing = relationships.find((r) => r.type === "outgoing");

					expect(outgoing?.referencingSchema).toBe(config.defaultSchema);
					expect(outgoing?.referencingTable).toBe("posts");
					expect(outgoing?.referencedSchema).toBe(config.defaultSchema);
					expect(outgoing?.referencedTable).toBe("users");
				}).pipe(Effect.provide(layer)),
		),

		it.effect(
			"includes correct schema information for incoming relationships",
			() =>
				Effect.gen(function* () {
					yield* setupSchema;

					const relationships = yield* getTableRelationships({
						schema: config.defaultSchema,
						table: "users",
					});

					relationships.forEach((rel) => {
						expect(rel.type).toBe("incoming");
						expect(rel.referencedSchema).toBe(config.defaultSchema);
						expect(rel.referencedTable).toBe("users");
						expect(rel.referencingSchema).toBe(config.defaultSchema);
					});
				}).pipe(Effect.provide(layer)),
		),

		it.effect("includes constraint names for all relationships", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "posts",
				});

				relationships.forEach((rel) => {
					expect(rel.constraintName).toBeDefined();
					expect(rel.constraintName.length).toBeGreaterThan(0);
				});
			}).pipe(Effect.provide(layer)),
		),

		it.effect("handles table with multiple outgoing FKs", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "comments",
				});

				// comments has outgoing FKs to posts and users
				const outgoing = relationships.filter((r) => r.type === "outgoing");
				expect(outgoing.length).toBe(2);

				const postFk = outgoing.find((r) => r.referencingColumn === "post_id");
				expect(postFk?.referencedTable).toBe("posts");

				const userFk = outgoing.find((r) => r.referencingColumn === "user_id");
				expect(userFk?.referencedTable).toBe("users");
			}).pipe(Effect.provide(layer)),
		),

		it.effect("handles one-to-one relationships", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "user_profiles",
				});

				// user_profiles has one outgoing FK to users (one-to-one)
				expect(relationships.length).toBe(1);
				expect(relationships[0].type).toBe("outgoing");
				expect(relationships[0].referencingColumn).toBe("user_id");
				expect(relationships[0].referencedTable).toBe("users");
			}).pipe(Effect.provide(layer)),
		),

		it.effect("handles many-to-many relationships through junction tables", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "post_tags",
				});

				// post_tags has outgoing FKs to posts and tags
				const outgoing = relationships.filter((r) => r.type === "outgoing");
				expect(outgoing.length).toBe(2);

				const postFk = outgoing.find((r) => r.referencingColumn === "post_id");
				expect(postFk?.referencedTable).toBe("posts");

				const tagFk = outgoing.find((r) => r.referencingColumn === "tag_id");
				expect(tagFk?.referencedTable).toBe("tags");
			}).pipe(Effect.provide(layer)),
		),

		it.effect("identifies junction table relationships correctly", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				// From posts perspective: incoming relationship from post_tags
				const postRelationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "posts",
				});

				const incomingFromJunction = postRelationships.find(
					(r) => r.type === "incoming" && r.referencingTable === "post_tags",
				);
				expect(incomingFromJunction).toBeDefined();
				expect(incomingFromJunction?.referencingColumn).toBe("post_id");

				// From tags perspective: incoming relationship from post_tags
				const tagRelationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "tags",
				});

				const incomingFromJunctionToTags = tagRelationships.find(
					(r) => r.type === "incoming" && r.referencingTable === "post_tags",
				);
				expect(incomingFromJunctionToTags).toBeDefined();
				expect(incomingFromJunctionToTags?.referencingColumn).toBe("tag_id");
			}).pipe(Effect.provide(layer)),
		),

		it.effect("orders results consistently", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
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
			}).pipe(Effect.provide(layer)),
		),

		it.effect("returns empty array for non-existent table", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "nonexistent_table",
				});

				expect(relationships).toEqual([]);
			}).pipe(Effect.provide(layer)),
		),

		it.effect("specifies correct relationship types", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
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
			}).pipe(Effect.provide(layer)),
		),

		it.effect("correctly identifies foreign key columns vs primary keys", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
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
			}).pipe(Effect.provide(layer)),
		),

		it.effect("retrieves only outgoing relationships for user_profiles", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "user_profiles",
				});

				// user_profiles only has outgoing FK to users
				expect(relationships.length).toBe(1);
				expect(relationships[0].type).toBe("outgoing");
				expect(relationships[0].referencingColumn).toBe("user_id");
				expect(relationships[0].referencedTable).toBe("users");
			}).pipe(Effect.provide(layer)),
		),

		it.effect("retrieves only incoming relationships for users", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "users",
				});

				// users has no outgoing FK but multiple incoming from user_profiles, posts, comments
				const outgoing = relationships.filter((r) => r.type === "outgoing");
				expect(outgoing.length).toBe(0);

				const incoming = relationships.filter((r) => r.type === "incoming");
				expect(incoming.length).toBe(3); // user_profiles, posts, comments
			}).pipe(Effect.provide(layer)),
		),

		it.effect("returns empty array for table with no relationships", () =>
			Effect.gen(function* () {
				yield* setupSchema;

				// Create an isolated table
				const client = yield* SqlClient.SqlClient;
				if (config.isPostgres) {
					yield* client`
						CREATE TABLE IF NOT EXISTS isolated_table (
							id SERIAL PRIMARY KEY,
							data TEXT
						)
					`;
				} else {
					yield* client`
						CREATE TABLE IF NOT EXISTS isolated_table (
							id INTEGER PRIMARY KEY,
							data TEXT
						)
					`;
				}

				const relationships = yield* getTableRelationships({
					schema: config.defaultSchema,
					table: "isolated_table",
				});

				expect(relationships).toEqual([]);
			}).pipe(Effect.provide(layer)),
		),
	];
};

describe("getTableRelationships (pglite)", () => {
	testSuite(pgliteLayer, postgresConfig).forEach((test) => {
		test;
	});
});

describe("getTableRelationships (libsql)", () => {
	testSuite(libsqlLayer, sqliteConfig).forEach((test) => {
		test;
	});
});
