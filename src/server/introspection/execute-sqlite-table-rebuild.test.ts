import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { executeSqliteTableRebuild } from "./introspection.ts";
import { libsqlLayer, makeTestLayer } from "./test.layer.ts";

describe("executeSqliteTableRebuild", () => {
  const testLayer = makeTestLayer(libsqlLayer);

  it.effect("runs rebuild steps and restores foreign_keys pragma", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`PRAGMA foreign_keys = ON`;
      yield* sql`DROP TABLE IF EXISTS widgets`;
      yield* sql`CREATE TABLE widgets (id INTEGER PRIMARY KEY, title TEXT)`;
      yield* sql`INSERT INTO widgets (id, title) VALUES (1, 'a')`;

      yield* executeSqliteTableRebuild({
        statements: [
          "BEGIN TRANSACTION;",
          'CREATE TABLE "widgets__dadabase_rebuild_test" (id INTEGER PRIMARY KEY, title TEXT NOT NULL);',
          'INSERT INTO "widgets__dadabase_rebuild_test" (id, title) SELECT id, title FROM "widgets";',
          'DROP TABLE "widgets";',
          'ALTER TABLE "widgets__dadabase_rebuild_test" RENAME TO "widgets";',
          "COMMIT;",
        ],
      });

      const rows = yield* sql<{ title: string }>`SELECT title FROM widgets`;
      expect(rows[0]?.title).toBe("a");

      const fk = yield* sql<{ foreign_keys: number }>`PRAGMA foreign_keys`;
      expect(Number(fk[0]?.foreign_keys)).toBe(1);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("restores foreign_keys pragma after a mid-script failure", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`PRAGMA foreign_keys = ON`;
      yield* sql`DROP TABLE IF EXISTS widgets`;
      yield* sql`CREATE TABLE widgets (id INTEGER PRIMARY KEY, title TEXT)`;

      const result = yield* executeSqliteTableRebuild({
        statements: [
          "BEGIN TRANSACTION;",
          'CREATE TABLE "widgets__dadabase_rebuild_fail" (id INTEGER PRIMARY KEY, title TEXT);',
          "SELECT * FROM definitely_missing_table;",
          "COMMIT;",
        ],
      }).pipe(Effect.result);

      expect(result._tag).toBe("Failure");

      const fk = yield* sql<{ foreign_keys: number }>`PRAGMA foreign_keys`;
      expect(Number(fk[0]?.foreign_keys)).toBe(1);
    }).pipe(Effect.provide(testLayer)),
  );
});
