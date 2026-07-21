import { describe, expect, it } from "vitest";

import type { SchemaDiffOp, TableStructure } from "./types.ts";

import { buildMigrationSql } from "./build-migration-sql.ts";
import { diffTableStructures } from "./diff-table-structures.ts";

const col = (
  name: string,
  dataType: string,
  nullable = true,
  extra: Partial<TableStructure["columns"][number]> = {},
) => ({ name, dataType, nullable, ...extra });

describe("diffTableStructures", () => {
  it("detects a newly added table", () => {
    const ops = diffTableStructures(
      [],
      [
        {
          schema: "public",
          table: "widgets",
          columns: [col("id", "integer", false, { primaryKey: true })],
        },
      ],
    );
    expect(ops).toEqual([
      {
        kind: "add-table",
        schema: "public",
        table: "widgets",
        columns: [col("id", "integer", false, { primaryKey: true })],
      },
    ]);
  });

  it("detects a dropped table", () => {
    const ops = diffTableStructures(
      [{ schema: "public", table: "widgets", columns: [col("id", "integer", false)] }],
      [],
    );
    expect(ops).toEqual([{ kind: "drop-table", schema: "public", table: "widgets" }]);
  });

  it("detects an unambiguous rename via matching column signature", () => {
    const columns = [col("id", "integer", false), col("name", "text", true)];
    const ops = diffTableStructures(
      [{ schema: "public", table: "widgets", columns }],
      [{ schema: "public", table: "gadgets", columns }],
    );
    expect(ops).toEqual([
      { kind: "rename-table", schema: "public", fromTable: "widgets", toTable: "gadgets" },
    ]);
  });

  it("falls back to drop+add when multiple tables share a signature", () => {
    const columns = [col("id", "integer", false)];
    const ops = diffTableStructures(
      [
        { schema: "public", table: "a", columns },
        { schema: "public", table: "b", columns },
      ],
      [{ schema: "public", table: "c", columns }],
    );
    expect(ops.some((op) => op.kind === "rename-table")).toBe(false);
    expect(ops.filter((op) => op.kind === "drop-table")).toHaveLength(2);
    expect(ops.filter((op) => op.kind === "add-table")).toHaveLength(1);
  });

  it("detects added, dropped, and altered columns on a common table", () => {
    const before: TableStructure[] = [
      {
        schema: "public",
        table: "widgets",
        columns: [col("id", "integer", false), col("title", "text", true), col("old", "text")],
      },
    ];
    const after: TableStructure[] = [
      {
        schema: "public",
        table: "widgets",
        columns: [
          col("id", "integer", false),
          col("title", "varchar(100)", false),
          col("qty", "integer"),
        ],
      },
    ];
    const ops = diffTableStructures(before, after);

    expect(ops).toContainEqual({
      kind: "add-column",
      schema: "public",
      table: "widgets",
      column: col("qty", "integer"),
    });
    expect(ops).toContainEqual({
      kind: "drop-column",
      schema: "public",
      table: "widgets",
      column: "old",
    });
    expect(ops).toContainEqual({
      kind: "alter-column",
      schema: "public",
      table: "widgets",
      column: "title",
      from: { dataType: "text", nullable: true, defaultValue: null },
      to: { dataType: "varchar(100)", nullable: false, defaultValue: null },
    });
  });

  it("emits no ops for identical structures", () => {
    const table: TableStructure = {
      schema: "public",
      table: "widgets",
      columns: [col("id", "integer", false)],
    };
    expect(diffTableStructures([table], [table])).toEqual([]);
  });

  it("detects a default value change", () => {
    const before: TableStructure[] = [
      { schema: "public", table: "t", columns: [col("a", "text", true, { defaultValue: null })] },
    ];
    const after: TableStructure[] = [
      { schema: "public", table: "t", columns: [col("a", "text", true, { defaultValue: "'x'" })] },
    ];
    const ops = diffTableStructures(before, after);
    expect(ops).toEqual([
      {
        kind: "alter-column",
        schema: "public",
        table: "t",
        column: "a",
        from: { dataType: "text", nullable: true, defaultValue: null },
        to: { dataType: "text", nullable: true, defaultValue: "'x'" },
      },
    ]);
  });
});

describe("buildMigrationSql", () => {
  it("builds CREATE TABLE for add-table", () => {
    const ops: SchemaDiffOp[] = [
      {
        kind: "add-table",
        schema: "public",
        table: "widgets",
        columns: [col("id", "integer", false, { primaryKey: true })],
      },
    ];
    expect(buildMigrationSql(ops, "postgres")).toBe(
      'CREATE TABLE "public"."widgets" (\n  "id" integer PRIMARY KEY NOT NULL\n);',
    );
  });

  it("builds DROP TABLE IF EXISTS for drop-table", () => {
    const ops: SchemaDiffOp[] = [{ kind: "drop-table", schema: "public", table: "widgets" }];
    expect(buildMigrationSql(ops, "postgres")).toBe('DROP TABLE IF EXISTS "public"."widgets";');
  });

  it("builds ALTER TABLE RENAME TO for rename-table", () => {
    const ops: SchemaDiffOp[] = [
      { kind: "rename-table", schema: "public", fromTable: "widgets", toTable: "gadgets" },
    ];
    expect(buildMigrationSql(ops, "postgres")).toBe(
      'ALTER TABLE "public"."widgets" RENAME TO "gadgets";',
    );
  });

  it("builds ADD COLUMN and DROP COLUMN clauses", () => {
    const ops: SchemaDiffOp[] = [
      { kind: "add-column", schema: "public", table: "t", column: col("qty", "integer", false) },
      { kind: "drop-column", schema: "public", table: "t", column: "old" },
    ];
    const sql = buildMigrationSql(ops, "postgres");
    expect(sql).toContain('ALTER TABLE "public"."t" ADD COLUMN "qty" integer NOT NULL;');
    expect(sql).toContain('ALTER TABLE "public"."t" DROP COLUMN "old";');
  });

  it("emits multiple ALTER COLUMN clauses for postgres alter-column", () => {
    const ops: SchemaDiffOp[] = [
      {
        kind: "alter-column",
        schema: "public",
        table: "t",
        column: "title",
        from: { dataType: "text", nullable: true, defaultValue: null },
        to: { dataType: "varchar(100)", nullable: false, defaultValue: "''" },
      },
    ];
    const sql = buildMigrationSql(ops, "postgres");
    expect(sql).toContain('ALTER COLUMN "title" TYPE varchar(100)');
    expect(sql).toContain('ALTER COLUMN "title" SET NOT NULL');
    expect(sql).toContain(`ALTER COLUMN "title" SET DEFAULT ''`);
  });

  it("emits a comment instead of ALTER COLUMN for sqlite", () => {
    const ops: SchemaDiffOp[] = [
      {
        kind: "alter-column",
        schema: "main",
        table: "t",
        column: "title",
        from: { dataType: "TEXT", nullable: true, defaultValue: null },
        to: { dataType: "INTEGER", nullable: true, defaultValue: null },
      },
    ];
    const sql = buildMigrationSql(ops, "sqlite");
    expect(sql).toContain("-- SQLite cannot ALTER COLUMN");
    expect(sql).toContain("buildSqliteRebuildAlterSql()");
    expect(sql.startsWith("ALTER TABLE")).toBe(false);
  });

  it("returns an empty string for no ops", () => {
    expect(buildMigrationSql([], "postgres")).toBe("");
  });
});
