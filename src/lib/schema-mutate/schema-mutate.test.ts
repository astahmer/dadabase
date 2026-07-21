import { describe, expect, it } from "vitest";

import {
  buildAddColumnSql,
  buildAlterColumnSql,
  buildCreateTableSql,
  buildDropColumnSql,
  buildDropTableSql,
  UnsupportedSchemaMutateError,
} from "./index.ts";

describe("buildCreateTableSql", () => {
  it("builds postgres create with schema", () => {
    const sql = buildCreateTableSql({
      dialect: "postgres",
      schema: "public",
      table: "widgets",
      columns: [
        { name: "id", dataType: "integer", nullable: false, primaryKey: true },
        { name: "title", dataType: "text", nullable: false },
      ],
    });
    expect(sql).toContain('CREATE TABLE "public"."widgets"');
    expect(sql).toContain('"id" integer PRIMARY KEY NOT NULL');
    expect(sql).toContain('"title" text NOT NULL');
  });

  it("builds sqlite create with INTEGER PK", () => {
    const sql = buildCreateTableSql({
      dialect: "sqlite",
      schema: "main",
      table: "widgets",
      columns: [{ name: "id", dataType: "INTEGER", nullable: false, primaryKey: true }],
    });
    expect(sql).toContain('CREATE TABLE "main"."widgets"');
    expect(sql).toContain('"id" INTEGER PRIMARY KEY');
    expect(sql).not.toContain("NOT NULL");
  });
});

describe("buildDropTableSql", () => {
  it("drops with IF EXISTS", () => {
    expect(buildDropTableSql({ dialect: "postgres", schema: "public", table: "widgets" })).toBe(
      'DROP TABLE IF EXISTS "public"."widgets";',
    );
  });
});

describe("buildAddColumnSql", () => {
  it("adds column with nullability and default", () => {
    const sql = buildAddColumnSql({
      dialect: "sqlite",
      schema: "main",
      table: "widgets",
      column: {
        name: "color",
        dataType: "TEXT",
        nullable: true,
        defaultValue: "'blue'",
      },
    });
    expect(sql).toContain('ALTER TABLE "main"."widgets"');
    expect(sql).toContain("ADD COLUMN \"color\" TEXT DEFAULT 'blue'");
  });
});

describe("buildDropColumnSql", () => {
  it("drops column", () => {
    expect(
      buildDropColumnSql({
        dialect: "postgres",
        schema: "public",
        table: "widgets",
        column: "color",
      }),
    ).toBe('ALTER TABLE "public"."widgets"\n  DROP COLUMN "color";');
  });
});

describe("buildAlterColumnSql", () => {
  it("emits postgres type + null + default alters", () => {
    const sql = buildAlterColumnSql({
      dialect: "postgres",
      schema: "public",
      table: "widgets",
      columnName: "title",
      previous: { dataType: "text", nullable: true, defaultValue: null },
      column: {
        name: "title",
        dataType: "varchar(100)",
        nullable: false,
        defaultValue: "''",
      },
    });
    expect(sql).toContain('ALTER COLUMN "title" TYPE varchar(100)');
    expect(sql).toContain('ALTER COLUMN "title" SET NOT NULL');
    expect(sql).toContain(`ALTER COLUMN "title" SET DEFAULT ''`);
  });

  it("refuses sqlite alter column", () => {
    expect(() =>
      buildAlterColumnSql({
        dialect: "sqlite",
        schema: "main",
        table: "widgets",
        columnName: "title",
        previous: { dataType: "TEXT", nullable: true, defaultValue: null },
        column: { name: "title", dataType: "INTEGER", nullable: false },
      }),
    ).toThrow(UnsupportedSchemaMutateError);
  });
});
