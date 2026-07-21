import { describe, expect, it } from "vitest";

import {
  buildSqliteRebuildAlterSql,
  buildSqliteRebuildAlterSteps,
} from "./build-sqlite-rebuild-alter-sql.ts";

const baseColumns = [
  { name: "id", dataType: "INTEGER", nullable: false, primaryKey: true },
  { name: "title", dataType: "TEXT", nullable: true },
];

describe("buildSqliteRebuildAlterSql", () => {
  it("wraps the rebuild in a transaction with FK pragmas for preview", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", dataType: "TEXT", nullable: false },
      shadowSuffix: "test",
    });
    const lines = sql.split("\n");
    expect(lines[0]).toBe("PRAGMA foreign_keys=OFF;");
    expect(lines[1]).toBe("BEGIN TRANSACTION;");
    expect(sql).toContain("COMMIT;");
    expect(sql.trim().endsWith("PRAGMA foreign_keys=ON;")).toBe(true);
  });

  it("creates a unique shadow table with the altered column definition", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", dataType: "TEXT", nullable: false },
      shadowSuffix: "abc",
    });
    expect(sql).toContain('CREATE TABLE "main"."widgets__dadabase_rebuild_abc"');
    expect(sql).toContain('"title" TEXT NOT NULL');
    expect(sql).toContain('"id" INTEGER PRIMARY KEY');
  });

  it("copies rows across, mapping the renamed column by position", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", newName: "name" },
      shadowSuffix: "abc",
    });
    expect(sql).toContain(
      'INSERT INTO "main"."widgets__dadabase_rebuild_abc" ("id", "name") SELECT "id", "title" FROM "main"."widgets";',
    );
  });

  it("drops the old table and renames the shadow table back", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", nullable: false },
      shadowSuffix: "abc",
    });
    expect(sql).toContain('DROP TABLE "main"."widgets";');
    expect(sql).toContain(
      'ALTER TABLE "main"."widgets__dadabase_rebuild_abc" RENAME TO "widgets";',
    );
  });

  it("applies a new default value", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", defaultValue: "'untitled'" },
      shadowSuffix: "abc",
    });
    expect(sql).toContain(`"title" TEXT DEFAULT 'untitled'`);
  });

  it("exposes steps without FK pragmas for reserved-connection execution", () => {
    const steps = buildSqliteRebuildAlterSteps({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", nullable: false },
      shadowSuffix: "abc",
    });
    expect(steps[0]).toBe("BEGIN TRANSACTION;");
    expect(steps.some((s) => s.startsWith("PRAGMA"))).toBe(false);
    expect(steps.at(-1)).toBe("COMMIT;");
  });

  it("throws when the column does not exist", () => {
    expect(() =>
      buildSqliteRebuildAlterSql({
        schema: "main",
        table: "widgets",
        columns: baseColumns,
        alter: { columnName: "missing" },
      }),
    ).toThrow('Column "missing" not found');
  });

  it("throws when the table name is missing", () => {
    expect(() =>
      buildSqliteRebuildAlterSql({
        schema: "main",
        table: "  ",
        columns: baseColumns,
        alter: { columnName: "title" },
      }),
    ).toThrow("Table name is required");
  });
});
