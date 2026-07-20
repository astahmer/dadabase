import { describe, expect, it } from "vitest";

import type { AiTableContext } from "./ai-types.ts";

import { suggestQueriesFromSchema } from "./suggest-queries.ts";

const table: AiTableContext = {
  schema: "public",
  table: "orders",
  columns: [
    { name: "id", dataType: "uuid", nullable: false, primaryKey: true },
    {
      name: "status",
      dataType: "text",
      nullable: false,
      primaryKey: false,
      isEnum: true,
      enumValues: ["pending", "shipped"],
    },
    {
      name: "notes",
      dataType: "text",
      nullable: true,
      primaryKey: false,
    },
    {
      name: "created_at",
      dataType: "timestamptz",
      nullable: false,
      primaryKey: false,
    },
  ],
};

describe("suggestQueriesFromSchema", () => {
  it("returns count, distinct enum, count-by, recent, and null check", () => {
    const queries = suggestQueriesFromSchema(table);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.length).toBeLessThanOrEqual(5);
    expect(queries.some((q) => q.kind === "count_all")).toBe(true);
    expect(queries.some((q) => q.kind === "distinct_enum")).toBe(true);
    expect(queries.some((q) => q.kind === "count_by")).toBe(true);
    expect(queries.some((q) => q.kind === "recent_rows")).toBe(true);
    expect(queries.some((q) => q.kind === "null_check")).toBe(true);
  });

  it("emits valid-looking SELECT SQL with qualified table", () => {
    const queries = suggestQueriesFromSchema(table);
    for (const q of queries) {
      expect(q.sql.toUpperCase()).toContain("SELECT");
      expect(q.sql).toContain('"public"."orders"');
      expect(q.title.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });

  it("still returns count_all for minimal tables", () => {
    const minimal: AiTableContext = {
      schema: "main",
      table: "t",
      columns: [{ name: "id", dataType: "integer", nullable: false, primaryKey: true }],
    };
    const queries = suggestQueriesFromSchema(minimal);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.kind).toBe("count_all");
  });

  it("treats status-like names as enum-ish without isEnum flag", () => {
    const ctx: AiTableContext = {
      schema: "public",
      table: "jobs",
      columns: [
        { name: "id", dataType: "int", nullable: false, primaryKey: true },
        { name: "type", dataType: "text", nullable: false, primaryKey: false },
      ],
    };
    const queries = suggestQueriesFromSchema(ctx);
    expect(queries.some((q) => q.kind === "distinct_enum" && q.sql.includes("type"))).toBe(true);
  });
});
