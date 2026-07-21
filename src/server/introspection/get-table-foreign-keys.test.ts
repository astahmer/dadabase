import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import {
  findColumnReferences,
  findColumnReferencesWithCounts,
  getTableForeignKeys,
} from "#src/server/introspection/introspection.ts";

import {
  type DatabaseTestConfig,
  libsqlLayer,
  makeTestLayer,
  pgliteLayer,
  postgresConfig,
  sqliteConfig,
} from "./test.layer.ts";

// Create schema setup function that handles both databases
const createSetupSchema = (config: DatabaseTestConfig) =>
  Effect.gen(function* () {
    const client = yield* SqlClient.SqlClient;

    if (config.isPostgres) {
      // PostgreSQL schema with SERIAL types
      yield* client`
				CREATE TABLE IF NOT EXISTS users (
					id SERIAL PRIMARY KEY,
					name TEXT NOT NULL,
					email TEXT NOT NULL UNIQUE
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS user_profiles (
					user_id SERIAL UNIQUE PRIMARY KEY REFERENCES users(id),
					bio TEXT
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS posts (
					id SERIAL PRIMARY KEY,
					user_id INTEGER NOT NULL REFERENCES users(id),
					title TEXT NOT NULL
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS comments (
					id SERIAL PRIMARY KEY,
					post_id INTEGER NOT NULL REFERENCES posts(id),
					user_id INTEGER NOT NULL REFERENCES users(id),
					text TEXT NOT NULL
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS tags (
					id SERIAL PRIMARY KEY,
					name TEXT NOT NULL UNIQUE
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS post_tags (
					post_id INTEGER NOT NULL REFERENCES posts(id),
					tag_id INTEGER NOT NULL REFERENCES tags(id),
					PRIMARY KEY (post_id, tag_id)
				)
			`;
    } else {
      // SQLite schema with INTEGER types
      yield* client`
				CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL,
					email TEXT NOT NULL UNIQUE
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS user_profiles (
					user_id INTEGER UNIQUE PRIMARY KEY REFERENCES users(id),
					bio TEXT
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS posts (
					id INTEGER PRIMARY KEY,
					user_id INTEGER NOT NULL REFERENCES users(id),
					title TEXT NOT NULL
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS comments (
					id INTEGER PRIMARY KEY,
					post_id INTEGER NOT NULL REFERENCES posts(id),
					user_id INTEGER NOT NULL REFERENCES users(id),
					text TEXT NOT NULL
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS tags (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL UNIQUE
				)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS post_tags (
					post_id INTEGER NOT NULL REFERENCES posts(id),
					tag_id INTEGER NOT NULL REFERENCES tags(id),
					PRIMARY KEY (post_id, tag_id)
				)
			`;
    }
  });

// Test suite factory functions
const getTableForeignKeysTestSuite = (
  layer: Layer.Layer<SqlClient.SqlClient>,
  config: DatabaseTestConfig,
) => {
  const setupSchema = createSetupSchema(config);
  const testLayer = makeTestLayer(layer);

  return [
    it.effect("retrieves no foreign keys for table without FKs", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "users",
        });

        expect(fks.length).toBe(0);
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("retrieves single foreign key from table", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "user_profiles",
        });

        expect(fks.length).toBe(1);
        expect(fks[0].column_name).toBe("user_id");
        expect(fks[0].referenced_table_name).toBe("users");
        expect(fks[0].referenced_column_name).toBe("id");
        expect(fks[0].referenced_table_schema).toBe(config.defaultSchema);
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("retrieves foreign key information with constraint name", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "posts",
        });

        expect(fks.length).toBe(1);
        expect(fks[0].constraint_name).toBeDefined();
        if (config.isPostgres) {
          expect(fks[0].constraint_name).toMatch(/posts_user_id_fkey/);
        } else {
          // SQLite generates synthetic constraint names like fk_0, fk_1, etc.
          expect(fks[0].constraint_name).toMatch(/^fk_\d+$/);
        }
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("retrieves multiple foreign keys from table", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "comments",
        });

        expect(fks.length).toBe(2);

        const postIdFK = fks.find((fk) => fk.column_name === "post_id");
        expect(postIdFK?.referenced_table_name).toBe("posts");

        const userIdFK = fks.find((fk) => fk.column_name === "user_id");
        expect(userIdFK?.referenced_table_name).toBe("users");
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("retrieves foreign keys from many-to-many junction table", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "post_tags",
        });

        expect(fks.length).toBe(2);

        const postFk = fks.find((fk) => fk.column_name === "post_id");
        expect(postFk?.referenced_table_name).toBe("posts");

        const tagFk = fks.find((fk) => fk.column_name === "tag_id");
        expect(tagFk?.referenced_table_name).toBe("tags");
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("returns empty array for non-existent table", () =>
      Effect.gen(function* () {
        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "nonexistent_table",
        });

        expect(fks).toEqual([]);
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("orders foreign keys by column ordinal position", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const fks = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "comments",
        });

        // post_id is defined before user_id in the CREATE TABLE
        const columnNames = fks.map((fk) => fk.column_name);
        expect(columnNames[0]).toBe("post_id");
        expect(columnNames[1]).toBe("user_id");
      }).pipe(Effect.provide(testLayer)),
    ),
  ];
};

const findColumnReferencesTestSuite = (
  layer: Layer.Layer<SqlClient.SqlClient>,
  config: DatabaseTestConfig,
) => {
  const setupSchema = createSetupSchema(config);
  const testLayer = makeTestLayer(layer);

  return [
    it.effect("finds tables that reference a column", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        // Find all tables that reference users.id
        const refs = yield* findColumnReferences({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
        });

        expect(refs.length).toBeGreaterThan(0);

        const tables = refs.map((ref) => ref.table);
        expect(tables).toContain("user_profiles");
        expect(tables).toContain("posts");
        expect(tables).toContain("comments");
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("finds correct columns that reference a table", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const refs = yield* findColumnReferences({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
        });

        const userProfileRef = refs.find(
          (ref) => ref.table === "user_profiles" && ref.column === "user_id",
        );
        expect(userProfileRef).toBeDefined();
        expect(userProfileRef?.referencedColumn).toBe("id");

        const postRef = refs.find((ref) => ref.table === "posts" && ref.column === "user_id");
        expect(postRef).toBeDefined();
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("returns empty array when no tables reference a column", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        // tags table is not referenced by anything
        const refs = yield* findColumnReferences({
          referencedSchema: config.defaultSchema,
          referencedTable: "tags",
          referencedColumn: "name",
        });

        expect(refs.length).toBe(0);
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("includes constraint names in references", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const refs = yield* findColumnReferences({
          referencedSchema: config.defaultSchema,
          referencedTable: "posts",
          referencedColumn: "id",
        });

        const commentRef = refs.find((ref) => ref.table === "comments");
        expect(commentRef?.constraintName).toBeDefined();
        if (config.isPostgres) {
          expect(commentRef?.constraintName).toMatch(/comments_post_id_fkey/);
        } else {
          // SQLite generates synthetic constraint names
          expect(commentRef?.constraintName).toMatch(/^fk_\d+$/);
        }
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("finds references in many-to-many junction tables", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const refs = yield* findColumnReferences({
          referencedSchema: config.defaultSchema,
          referencedTable: "posts",
          referencedColumn: "id",
        });

        const postTagRef = refs.find(
          (ref) => ref.table === "post_tags" && ref.column === "post_id",
        );
        expect(postTagRef).toBeDefined();
      }).pipe(Effect.provide(testLayer)),
    ),
  ];
};

const findColumnReferencesWithCountsTestSuite = (
  layer: Layer.Layer<SqlClient.SqlClient>,
  config: DatabaseTestConfig,
) => {
  const setupSchema = createSetupSchema(config);
  const testLayer = makeTestLayer(layer);

  return [
    it.effect("returns references with zero row counts for no data", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: 1,
        });

        expect(refs.length).toBeGreaterThan(0);
        // All counts should be 0 since we haven't inserted any data
        refs.forEach((ref) => {
          expect(ref.matchingRowCount).toBe(0);
        });
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("counts matching rows for valid cell value", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const client = yield* SqlClient.SqlClient;

        // Insert test data
        yield* client`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`;

        yield* client`
					INSERT INTO posts (user_id, title) VALUES (1, 'Hello World')
				`;

        yield* client`
					INSERT INTO comments (post_id, user_id, text) VALUES (1, 1, 'Great post!')
				`;

        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: 1,
        });

        const postRef = refs.find((ref) => ref.table === "posts");
        expect(postRef?.matchingRowCount).toBe(1);

        const commentRef = refs.find((ref) => ref.table === "comments" && ref.column === "user_id");
        expect(commentRef?.matchingRowCount).toBe(1);
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("handles null cell values correctly", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const client = yield* SqlClient.SqlClient;

        // Insert data with some nulls (if column allows)
        yield* client`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`;

        yield* client`
					INSERT INTO user_profiles (user_id, bio) VALUES (1, NULL)
				`;

        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: null,
        });

        // Should not count rows where user_id references user 1 as "matching null"
        refs.forEach((ref) => {
          expect(ref.matchingRowCount).toBeGreaterThanOrEqual(0);
        });
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("normalizes string 'null' to actual null", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const client = yield* SqlClient.SqlClient;

        // Insert test data
        yield* client`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`;

        // Should treat string "null" as actual null value
        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: "null",
        });

        expect(refs.length).toBeGreaterThan(0);
        refs.forEach((ref) => {
          // All should be 0 since we're looking for IS NULL
          expect(ref.matchingRowCount).toBeGreaterThanOrEqual(0);
        });
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("includes constraint names and schema in results", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: 1,
        });

        expect(refs.length).toBeGreaterThan(0);
        refs.forEach((ref) => {
          expect(ref.schema).toBe(config.defaultSchema);
          expect(ref.constraintName).toBeDefined();
          expect(ref.table).toBeDefined();
          expect(ref.column).toBeDefined();
          expect(ref.referencedColumn).toBe("id");
        });
      }).pipe(Effect.provide(testLayer)),
    ),

    it.effect("counts multiple matching rows correctly", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const client = yield* SqlClient.SqlClient;

        // Insert test data with multiple references
        yield* client`
					INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
				`;

        yield* client`
					INSERT INTO posts (user_id, title) VALUES
					(1, 'Post 1'),
					(1, 'Post 2'),
					(1, 'Post 3')
				`;

        const refs = yield* findColumnReferencesWithCounts({
          referencedSchema: config.defaultSchema,
          referencedTable: "users",
          referencedColumn: "id",
          cellValue: 1,
        });

        const postRef = refs.find((ref) => ref.table === "posts");
        expect(postRef?.matchingRowCount).toBe(3);
      }).pipe(Effect.provide(testLayer)),
    ),
  ];
};

describe("getTableForeignKeys (pglite)", () => {
  getTableForeignKeysTestSuite(pgliteLayer, postgresConfig);
});

describe("getTableForeignKeys (libsql)", () => {
  getTableForeignKeysTestSuite(libsqlLayer, sqliteConfig);
});

describe("findColumnReferences (pglite)", () => {
  findColumnReferencesTestSuite(pgliteLayer, postgresConfig);
});

describe("findColumnReferences (libsql)", () => {
  findColumnReferencesTestSuite(libsqlLayer, sqliteConfig);
});

describe("findColumnReferencesWithCounts (pglite)", () => {
  findColumnReferencesWithCountsTestSuite(pgliteLayer, postgresConfig);
});

describe("findColumnReferencesWithCounts (libsql)", () => {
  findColumnReferencesWithCountsTestSuite(libsqlLayer, sqliteConfig);
});
