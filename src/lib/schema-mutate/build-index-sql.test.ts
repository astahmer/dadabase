import { describe, expect, it } from "vitest";

import { buildCreateIndexSql, buildDropIndexSql } from "./build-index-sql.ts";

describe("buildCreateIndexSql", () => {
  it("builds a simple index", () => {
    expect(
      buildCreateIndexSql({
        dialect: "postgres",
        schema: "public",
        table: "widgets",
        indexName: "idx_widgets_name",
        columns: ["name"],
      }),
    ).toBe('CREATE INDEX IF NOT EXISTS "idx_widgets_name" ON "public"."widgets" ("name");');
  });

  it("builds a unique index over multiple columns with direction", () => {
    const sql = buildCreateIndexSql({
      dialect: "postgres",
      schema: "public",
      table: "widgets",
      indexName: "idx_unique",
      unique: true,
      ifNotExists: false,
      columns: [
        { name: "a", direction: "asc" },
        { name: "b", direction: "desc" },
      ],
    });
    expect(sql).toBe('CREATE UNIQUE INDEX "idx_unique" ON "public"."widgets" ("a" ASC, "b" DESC);');
  });

  it("works for sqlite dialect", () => {
    const sql = buildCreateIndexSql({
      dialect: "sqlite",
      schema: "main",
      table: "widgets",
      indexName: "idx_widgets_name",
      columns: ["name"],
    });
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_widgets_name" ON "main"."widgets" ("name");');
  });

  it("throws when index name is missing", () => {
    expect(() =>
      buildCreateIndexSql({
        dialect: "postgres",
        schema: "public",
        table: "t",
        indexName: "",
        columns: ["a"],
      }),
    ).toThrow("Index name is required");
  });

  it("throws when no columns are given", () => {
    expect(() =>
      buildCreateIndexSql({
        dialect: "postgres",
        schema: "public",
        table: "t",
        indexName: "idx",
        columns: [],
      }),
    ).toThrow("At least one column is required");
  });
});

describe("buildDropIndexSql", () => {
  it("qualifies with schema and defaults to IF EXISTS", () => {
    expect(buildDropIndexSql({ dialect: "postgres", schema: "public", indexName: "idx" })).toBe(
      'DROP INDEX IF EXISTS "public"."idx";',
    );
  });

  it("omits IF EXISTS when disabled", () => {
    expect(
      buildDropIndexSql({
        dialect: "postgres",
        schema: "public",
        indexName: "idx",
        ifExists: false,
      }),
    ).toBe('DROP INDEX "public"."idx";');
  });

  it("throws when index name is missing", () => {
    expect(() =>
      buildDropIndexSql({ dialect: "postgres", schema: "public", indexName: "" }),
    ).toThrow("Index name is required");
  });
});
