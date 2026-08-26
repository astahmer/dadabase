import { describe, expect, it } from "vitest";

import type { AiSchemaContext } from "./ai-types.ts";
import { applyAutoSelection, buildAutoSelectPrompt, parseAutoSelectedTables } from "./schema-auto-select.ts";

const makeSchema = (names: string[]): AiSchemaContext => ({
  schema: "public",
  dialect: "postgres",
  tables: names.map((name) => ({
    schema: "public",
    table: name,
    dialect: "postgres",
    columns: [{ name: "id", dataType: "int", nullable: false, primaryKey: true }],
  })),
});

describe("buildAutoSelectPrompt", () => {
  it("lists every table with its column names and asks for a JSON array", () => {
    const schema = makeSchema(["users", "orders"]);
    schema.tables[0].columns = [
      { name: "id", dataType: "int", nullable: false, primaryKey: true },
      { name: "email", dataType: "text", nullable: true, primaryKey: false },
    ];
    const prompt = buildAutoSelectPrompt(schema.tables);
    expect(prompt).toContain("- users(id,email)");
    expect(prompt).toContain("- orders(id)");
    expect(prompt).toContain("JSON array");
    expect(prompt).not.toContain("NOT NULL");
  });
});

describe("parseAutoSelectedTables", () => {
  const known = ["users", "orders", "videos"];

  it("parses a plain JSON array", () => {
    expect(parseAutoSelectedTables('["videos","users"]', known)).toEqual(["users", "videos"]);
  });

  it("parses JSON inside code fences", () => {
    expect(parseAutoSelectedTables('```json\n["orders"]\n```', known)).toEqual(["orders"]);
  });

  it("drops unknown names and preserves the canonical order", () => {
    expect(parseAutoSelectedTables('["nope","videos","also_nope"]', known)).toEqual(["videos"]);
  });

  it("collapses duplicates", () => {
    expect(parseAutoSelectedTables('["users","users"]', known)).toEqual(["users"]);
  });

  it("tolerates a bare comma-separated fallback", () => {
    expect(parseAutoSelectedTables("users, orders", known)).toEqual(["users", "orders"]);
  });

  it("returns null for garbage replies", () => {
    expect(parseAutoSelectedTables("I could not help with that.", known)).toBeNull();
    expect(parseAutoSelectedTables('{"tables":["users"]}', known)).toBeNull();
    expect(parseAutoSelectedTables("[1,2]", known)).toBeNull();
  });
});

describe("applyAutoSelection", () => {
  it("filters to the picked subset when parsing succeeds", () => {
    const schema = makeSchema(["users", "orders", "videos"]);
    const filtered = applyAutoSelection({ reply: '["orders"]', schema });
    expect(filtered.tables.map((t) => t.table)).toEqual(["orders"]);
  });

  it("falls back to the full schema on garbage replies", () => {
    const schema = makeSchema(["users", "orders"]);
    expect(applyAutoSelection({ reply: "cannot parse this", schema })).toEqual(schema);
  });

  it("falls back to the full schema when nothing usable is selected", () => {
    const schema = makeSchema(["users", "orders"]);
    expect(applyAutoSelection({ reply: '["ghost_table"]', schema })).toEqual(schema);
  });
});
