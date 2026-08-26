// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { AiSchemaContext } from "./ai-types.ts";
import {
  applySelectedTables,
  getStoredChatSchemaSelection,
  normalizeChatSchemaMode,
  resolveSchemaRequestParts,
  setStoredChatSchemaSelection,
} from "./chat-schema-selection.ts";

const table = (name: string) => ({
  schema: "public",
  table: name,
  dialect: "postgres",
  columns: [],
});

const makeSchema = (names: string[]): AiSchemaContext => ({
  schema: "public",
  dialect: "postgres",
  tables: names.map(table),
});

describe("normalizeChatSchemaMode", () => {
  it("passes known modes through and defaults unknown values to all", () => {
    expect(normalizeChatSchemaMode("auto")).toBe("auto");
    expect(normalizeChatSchemaMode("selected")).toBe("selected");
    expect(normalizeChatSchemaMode("nonsense")).toBe("all");
    expect(normalizeChatSchemaMode(undefined)).toBe("all");
    expect(normalizeChatSchemaMode(42)).toBe("all");
  });
});

describe("applySelectedTables", () => {
  const schema = makeSchema(["users", "orders", "videos"]);

  it("keeps only the selected tables in schema order", () => {
    const filtered = applySelectedTables(schema, ["videos", "users"]);
    expect(filtered.tables.map((t) => t.table)).toEqual(["users", "videos"]);
    // Other schema fields are preserved.
    expect(filtered.schema).toBe("public");
    expect(filtered.dialect).toBe("postgres");
  });

  it("drops unknown table names silently", () => {
    const filtered = applySelectedTables(schema, ["users", "not_a_table"]);
    expect(filtered.tables.map((t) => t.table)).toEqual(["users"]);
  });

  it("an explicit empty selection yields zero tables", () => {
    expect(applySelectedTables(schema, []).tables).toEqual([]);
  });

  it("an undefined selection yields zero tables (select-none state)", () => {
    expect(applySelectedTables(schema, undefined).tables).toEqual([]);
  });
});

describe("resolveSchemaRequestParts", () => {
  const schema = makeSchema(["users", "orders"]);
  const selection = { mode: "selected" as const, selectedTables: ["orders"] };

  it("all mode sends the full schema without a mode flag", () => {
    const parts = resolveSchemaRequestParts(schema, { mode: "all" });
    expect(parts.schemaContext).toEqual(schema);
    expect(parts.schemaMode).toBeUndefined();
  });

  it("selected mode filters client-side without a mode flag", () => {
    const parts = resolveSchemaRequestParts(schema, selection);
    expect(parts.schemaContext?.tables.map((t) => t.table)).toEqual(["orders"]);
    expect(parts.schemaMode).toBeUndefined();
  });

  it("auto mode sends the full schema with the auto flag", () => {
    const parts = resolveSchemaRequestParts(schema, { mode: "auto" });
    expect(parts.schemaContext).toEqual(schema);
    expect(parts.schemaMode).toBe("auto");
  });

  it("undefined schema context short-circuits regardless of mode", () => {
    expect(resolveSchemaRequestParts(undefined, selection)).toEqual({});
  });
});

describe("storage round-trip", () => {
  it("persists and restores a selection per connection name", () => {
    setStoredChatSchemaSelection("conn-a", { mode: "selected", selectedTables: ["users"] });
    setStoredChatSchemaSelection("conn-b", { mode: "auto" });

    expect(getStoredChatSchemaSelection("conn-a")).toEqual({
      mode: "selected",
      selectedTables: ["users"],
    });
    expect(getStoredChatSchemaSelection("conn-b")).toEqual({ mode: "auto" });
  });

  it("corrupt storage falls back to the default (all)", () => {
    window.localStorage.setItem(
      "dadabase.chat.schema-selection.broken",
      "{not json",
    );
    expect(getStoredChatSchemaSelection("broken")).toEqual({ mode: "all" });
  });

  it("unknown stored modes and non-string table names are normalized away", () => {
    window.localStorage.setItem(
      "dadabase.chat.schema-selection.weird",
      JSON.stringify({ mode: "bogus", selectedTables: ["ok", 7, null] }),
    );
    expect(getStoredChatSchemaSelection("weird")).toEqual({
      mode: "all",
      selectedTables: ["ok"],
    });
  });
});
