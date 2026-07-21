import { describe, expect, it } from "vitest";

import { buildSqliteRebuildAlterSql } from "./build-sqlite-rebuild-alter-sql.ts";

const baseColumns = [
  { name: "id", dataType: "INTEGER", nullable: false, primaryKey: true },
  { name: "title", dataType: "TEXT", nullable: true },
];

describe("buildSqliteRebuildAlterSql", () => {
  it("wraps the rebuild in a transaction with FK pragmas", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", dataType: "TEXT", nullable: false },
    });
    const lines = sql.split("\n");
    expect(lines[0]).toBe("PRAGMA foreign_keys=OFF;");
    expect(lines[1]).toBe("BEGIN TRANSACTION;");
    expect(sql).toContain("COMMIT;");
    expect(sql.trim().endsWith("PRAGMA foreign_keys=ON;")).toBe(true);
  });

  it("creates a shadow table with the altered column definition", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", dataType: "TEXT", nullable: false },
    });
    expect(sql).toContain('CREATE TABLE "main"."widgets__dadabase_rebuild"');
    expect(sql).toContain('"title" TEXT NOT NULL');
    expect(sql).toContain('"id" INTEGER PRIMARY KEY');
  });

  it("copies rows across, mapping the renamed column by position", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", newName: "name" },
    });
    expect(sql).toContain(
      'INSERT INTO "main"."widgets__dadabase_rebuild" ("id", "name") SELECT "id", "title" FROM "main"."widgets";',
    );
  });

  it("drops the old table and renames the shadow table back", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", nullable: false },
    });
    expect(sql).toContain('DROP TABLE "main"."widgets";');
    expect(sql).toContain('ALTER TABLE "main"."widgets__dadabase_rebuild" RENAME TO "widgets";');
  });

  it("applies a new default value", () => {
    const sql = buildSqliteRebuildAlterSql({
      schema: "main",
      table: "widgets",
      columns: baseColumns,
      alter: { columnName: "title", defaultValue: "'untitled'" },
    });
    expect(sql).toContain(`"title" TEXT DEFAULT 'untitled'`);
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
