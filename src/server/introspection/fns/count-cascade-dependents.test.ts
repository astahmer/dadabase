import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeTestLayer, libsqlLayer, sqliteConfig } from "../test.layer.ts";
import { MAX_CASCADE_SEED_ROWS, countCascadeDependentsWalk } from "./count-cascade-dependents.ts";

describe("MAX_CASCADE_SEED_ROWS", () => {
  it("caps seed fan-out", () => {
    expect(MAX_CASCADE_SEED_ROWS).toBe(1_000);
  });
});

describe("countCascadeDependentsWalk (sqlite/libsql)", () => {
  const testLayer = makeTestLayer(libsqlLayer);

  const setup = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`PRAGMA foreign_keys = ON`;
    yield* sql`DROP TABLE IF EXISTS comments`;
    yield* sql`DROP TABLE IF EXISTS posts`;
    yield* sql`DROP TABLE IF EXISTS users`;
    yield* sql`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY,
				name TEXT NOT NULL
			)
		`;
    yield* sql`
			CREATE TABLE posts (
				id INTEGER PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				org_id INTEGER NOT NULL,
				title TEXT NOT NULL,
				UNIQUE (org_id, id)
			)
		`;
    yield* sql`
			CREATE TABLE comments (
				id INTEGER PRIMARY KEY,
				post_org INTEGER NOT NULL,
				post_id INTEGER NOT NULL,
				body TEXT NOT NULL,
				FOREIGN KEY (post_org, post_id) REFERENCES posts(org_id, id) ON DELETE CASCADE
			)
		`;
    yield* sql`INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob')`;
    yield* sql`INSERT INTO posts (id, user_id, org_id, title) VALUES
			(10, 1, 1, 'A1'),
			(11, 1, 1, 'A2'),
			(20, 2, 2, 'B1')`;
    yield* sql`INSERT INTO comments (id, post_org, post_id, body) VALUES
			(100, 1, 10, 'c1'),
			(101, 1, 10, 'c2'),
			(102, 1, 11, 'c3')`;
  });

  it.effect("counts direct single-column dependents", () =>
    Effect.gen(function* () {
      yield* setup;
      const counts = yield* countCascadeDependentsWalk({
        schema: sqliteConfig.defaultSchema === "main" ? "" : sqliteConfig.defaultSchema,
        rootTable: "users",
        rootRows: [{ id: 1 }],
        edges: [
          {
            viaTable: "users",
            childTable: "posts",
            childColumns: ["user_id"],
            parentColumns: ["id"],
            seedChildren: false,
          },
        ],
      });
      expect(counts.posts).toBe(2);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("counts composite FKs and seeds transitive hops", () =>
    Effect.gen(function* () {
      yield* setup;
      const counts = yield* countCascadeDependentsWalk({
        schema: "",
        rootTable: "users",
        rootRows: [{ id: 1 }],
        edges: [
          {
            viaTable: "users",
            childTable: "posts",
            childColumns: ["user_id"],
            parentColumns: ["id"],
            seedChildren: true,
            seedColumns: ["org_id", "id"],
          },
          {
            viaTable: "posts",
            childTable: "comments",
            childColumns: ["post_org", "post_id"],
            parentColumns: ["org_id", "id"],
            seedChildren: false,
          },
        ],
      });
      expect(counts.posts).toBe(2);
      expect(counts.comments).toBe(3);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("returns 0 when parent has no matching children", () =>
    Effect.gen(function* () {
      yield* setup;
      const counts = yield* countCascadeDependentsWalk({
        schema: "",
        rootTable: "users",
        rootRows: [{ id: 99 }],
        edges: [
          {
            viaTable: "users",
            childTable: "posts",
            childColumns: ["user_id"],
            parentColumns: ["id"],
            seedChildren: true,
            seedColumns: ["org_id", "id"],
          },
          {
            viaTable: "posts",
            childTable: "comments",
            childColumns: ["post_org", "post_id"],
            parentColumns: ["org_id", "id"],
            seedChildren: false,
          },
        ],
      });
      expect(counts.posts).toBe(0);
      expect(counts.comments).toBe(0);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("returns null when edge columns are empty or mismatched", () =>
    Effect.gen(function* () {
      yield* setup;
      const counts = yield* countCascadeDependentsWalk({
        schema: "",
        rootTable: "users",
        rootRows: [{ id: 1 }],
        edges: [
          {
            viaTable: "users",
            childTable: "posts",
            childColumns: [],
            parentColumns: [],
            seedChildren: false,
          },
          {
            viaTable: "users",
            childTable: "comments",
            childColumns: ["post_org", "post_id"],
            parentColumns: ["id"],
            seedChildren: false,
          },
        ],
      });
      expect(counts.posts).toBeNull();
      expect(counts.comments).toBeNull();
    }).pipe(Effect.provide(testLayer)),
  );
});
