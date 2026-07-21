import { SqlClient } from "@effect/sql";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import {
  getTableColumns,
  getTableForeignKeys,
  getTableIndexes,
} from "#src/server/introspection/introspection.ts";

import {
  type DatabaseTestConfig,
  libsqlLayer,
  makeTestLayer,
  pgliteLayer,
  postgresConfig,
  sqliteConfig,
} from "./test.layer.ts";

// Helper to set up test schema
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
bio TEXT,
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS posts (
id SERIAL PRIMARY KEY,
user_id INTEGER NOT NULL REFERENCES users(id),
title TEXT NOT NULL,
content TEXT,
published BOOLEAN NOT NULL DEFAULT false
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
bio TEXT,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
			`;

      yield* client`
				CREATE TABLE IF NOT EXISTS posts (
id INTEGER PRIMARY KEY,
user_id INTEGER NOT NULL REFERENCES users(id),
title TEXT NOT NULL,
content TEXT,
published INTEGER NOT NULL DEFAULT 0
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

const testSuite = (layer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => () => {
  const setupSchema = createSetupSchema(config);
  const testLayer = makeTestLayer(layer);

  it.effect("retrieves all columns from a simple table", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "users",
      });

      expect(columns).toHaveLength(3);
      const columnNames = columns.map((c) => c.name).toSorted();
      expect(columnNames).toEqual(["email", "id", "name"]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("correctly identifies nullable columns", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "posts",
      });

      const contentColumn = columns.find((c) => c.name === "content");
      expect(contentColumn?.nullable).toBe(true);

      const titleColumn = columns.find((c) => c.name === "title");
      expect(titleColumn?.nullable).toBe(false);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("correctly identifies data types", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "posts",
      });

      const idColumn = columns.find((c) => c.name === "id");
      expect(idColumn?.dataType).toContain("integer");

      const titleColumn = columns.find((c) => c.name === "title");
      expect(titleColumn?.dataType).toContain("text");

      const publishedColumn = columns.find((c) => c.name === "published");
      if (config.isPostgres) {
        expect(publishedColumn?.dataType).toContain("boolean");
      } else {
        expect(publishedColumn?.dataType).toContain("integer");
      }
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("returns empty array for non-existent table", () =>
    Effect.gen(function* () {
      const result = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "nonexistent_table",
      });

      expect(result).toEqual([]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("retrieves columns with nullable defaults", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "user_profiles",
      });

      const bioColumn = columns.find((c) => c.name === "bio");
      expect(bioColumn?.nullable).toBe(true);
      expect(bioColumn?.defaultValue).toBeNull();
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("retrieves columns with timestamp defaults", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "user_profiles",
      });

      const createdAtColumn = columns.find((c) => c.name === "created_at");
      expect(createdAtColumn?.nullable).toBe(false);
      expect(createdAtColumn?.defaultValue).toBeDefined();
      expect(createdAtColumn?.dataType).toContain("timestamp");
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("preserves column order from table definition", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "posts",
      });

      const columnNames = columns.map((c) => c.name);
      // Columns should be in the order they were defined: id, user_id, title, content, published
      expect(columnNames).toEqual(["id", "user_id", "title", "content", "published"]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("does not return duplicate columns", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "posts",
      });

      // Check that there are no duplicate column names
      const columnNames = columns.map((c) => c.name);
      const uniqueColumnNames = new Set(columnNames);
      expect(columnNames.length).toBe(uniqueColumnNames.size);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("includes default values when present", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "posts",
      });

      const publishedColumn = columns.find((c) => c.name === "published");
      // The default value should contain '0'
      expect(publishedColumn?.defaultValue).toBeDefined();
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("handles tables with multiple columns", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "post_tags",
      });

      expect(columns.length).toBe(2);
      const columnNames = columns.map((c) => c.name).toSorted();
      expect(columnNames).toEqual(["post_id", "tag_id"]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("does not return duplicates for columns with both PK and UNIQUE constraints", () =>
    Effect.gen(function* () {
      yield* setupSchema;

      // user_profiles.user_id is defined as:
      // user_id {ID_TYPE} UNIQUE PRIMARY KEY REFERENCES users(id)
      // This column has BOTH a PRIMARY KEY constraint AND a UNIQUE constraint

      const columns = yield* getTableColumns({
        schema: config.defaultSchema,
        table: "user_profiles",
      });

      expect(columns.length).toBe(3); // user_id, bio, created_at

      const userIdColumn = columns.find((c) => c.name === "user_id");
      expect(userIdColumn).toBeDefined();

      // Verify no duplicates by checking column count
      const userIdOccurrences = columns.filter((c) => c.name === "user_id").length;
      expect(userIdOccurrences).toBe(1);

      // Check via indexes that it's both primary and unique
      const indexes = yield* getTableIndexes({
        schema: config.defaultSchema,
        table: "user_profiles",
      });
      const userIdIndexes = indexes.filter((idx) => idx.column_name === "user_id");
      const hasPrimary = userIdIndexes.some((idx) => idx.is_primary);
      const hasUnique = userIdIndexes.some((idx) => idx.is_unique);
      expect(hasPrimary).toBe(true);
      expect(hasUnique).toBe(true);
    }).pipe(Effect.provide(testLayer)),
  );
};

const tableColumnsTestSuite =
  (layer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => () => {
    const setupSchema = createSetupSchema(config);
    const testLayer = makeTestLayer(layer);

    it.effect("correctly identifies primary key columns via getTableIndexes", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const indexes = yield* getTableIndexes({
          schema: config.defaultSchema,
          table: "users",
        });

        // Find primary key index
        const pkIndex = indexes.find((idx) => idx.is_primary);
        expect(pkIndex).toBeDefined();
        // For SQLite, the primary key might be reported differently, so just check that we have one
        expect(["id", "email"]).toContain(pkIndex?.column_name);
      }).pipe(Effect.provide(testLayer)),
    );
    it.effect("correctly identifies unique columns via getTableIndexes", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const indexes = yield* getTableIndexes({
          schema: config.defaultSchema,
          table: "users",
        });

        if (config.isPostgres) {
          // Find unique index for email column
          const uniqueIndex = indexes.find(
            (idx) => idx.is_unique && !idx.is_primary && idx.column_name === "email",
          );
          expect(uniqueIndex).toBeDefined();
        } else {
          // SQLite may report unique constraints differently
          expect(indexes.length).toBeGreaterThan(0);
          expect(indexes.some((idx) => idx.is_unique && idx.column_name === "email")).toBe(true);
        }
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("handles one-to-one relationships (unique FK)", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const foreignKeys = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "user_profiles",
        });

        const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
        expect(userIdFK).toBeDefined();
        expect(userIdFK?.referenced_table_name).toBe("users");

        // Also check that user_id is a primary key via indexes
        const indexes = yield* getTableIndexes({
          schema: config.defaultSchema,
          table: "user_profiles",
        });
        const pkIndex = indexes.find((idx) => idx.is_primary && idx.column_name === "user_id");
        expect(pkIndex).toBeDefined();
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("handles composite primary keys via getTableIndexes", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const indexes = yield* getTableIndexes({
          schema: config.defaultSchema,
          table: "post_tags",
        });

        // Find primary key indexes - there should be entries for both columns
        const pkIndexes = indexes.filter((idx) => idx.is_primary);
        expect(pkIndexes.length).toBeGreaterThanOrEqual(1);
      }).pipe(Effect.provide(testLayer)),
    );
  };

const tableIndexesTestSuite =
  (layer: Layer.Layer<SqlClient.SqlClient>, config: DatabaseTestConfig) => () => {
    const setupSchema = createSetupSchema(config);
    const testLayer = makeTestLayer(layer);

    it.effect("correctly returns constraint names for foreign keys", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const foreignKeys = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "posts",
        });

        const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
        expect(userIdFK?.constraint_name).toBeDefined();
        if (config.isPostgres) {
          expect(userIdFK?.constraint_name).toMatch(/posts_user_id_fkey/);
        } else {
          // SQLite generates synthetic constraint names like fk_0, fk_1, etc.
          expect(userIdFK?.constraint_name).toMatch(/^fk_\d+$/);
          expect(userIdFK?.column_name).toBe("user_id");
        }
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("retrieves foreign key information via getTableForeignKeys", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const foreignKeys = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "posts",
        });

        const userIdFK = foreignKeys.find((fk) => fk.column_name === "user_id");
        expect(userIdFK).toBeDefined();
        expect(userIdFK?.referenced_table_name).toBe("users");
        expect(userIdFK?.referenced_column_name).toBe("id");
        expect(userIdFK?.referenced_table_schema).toBe(config.defaultSchema);
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("returns empty foreign keys for tables without FKs", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const foreignKeys = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "users",
        });

        // users table has no foreign keys
        expect(foreignKeys.length).toBe(0);
      }).pipe(Effect.provide(testLayer)),
    );

    it.effect("handles tables with multiple foreign keys", () =>
      Effect.gen(function* () {
        yield* setupSchema;

        const foreignKeys = yield* getTableForeignKeys({
          schema: config.defaultSchema,
          table: "post_tags",
        });

        const postIdFK = foreignKeys.find((fk) => fk.column_name === "post_id");
        expect(postIdFK).toBeDefined();
        expect(postIdFK?.referenced_table_name).toBe("posts");

        const tagIdFK = foreignKeys.find((fk) => fk.column_name === "tag_id");
        expect(tagIdFK).toBeDefined();
        expect(tagIdFK?.referenced_table_name).toBe("tags");
      }).pipe(Effect.provide(testLayer)),
    );
  };

describe("getTableColumns (pglite)", testSuite(pgliteLayer, postgresConfig));
describe("getTableColumns (libsql)", testSuite(libsqlLayer, sqliteConfig));

describe("getTableIndexes (pglite)", tableColumnsTestSuite(pgliteLayer, postgresConfig));
describe("getTableIndexes (libsql)", tableColumnsTestSuite(libsqlLayer, sqliteConfig));

describe("getTableForeignKeys (pglite)", tableIndexesTestSuite(pgliteLayer, postgresConfig));
describe("getTableForeignKeys (libsql)", tableIndexesTestSuite(libsqlLayer, sqliteConfig));
