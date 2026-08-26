import { describe, expect, it } from "vitest";

import {
  DEFAULT_SQL_SNIPPETS,
  resolveSnippetSql,
  snippetReferencesTable,
} from "./sql-snippets.ts";

describe("snippet table token", () => {
  it("replaces every token occurrence with the chosen table", () => {
    expect(resolveSnippetSql("SELECT * FROM {{table}} JOIN {{table}} t2 ON 1=1", "users")).toBe(
      "SELECT * FROM users JOIN users t2 ON 1=1",
    );
  });

  it("leaves sql without tokens unchanged", () => {
    expect(resolveSnippetSql("SELECT 1", "users")).toBe("SELECT 1");
  });

  it("keeps the literal token when no table is available", () => {
    expect(resolveSnippetSql("SELECT * FROM {{table}}", "")).toBe(
      "SELECT * FROM {{table}}",
    );
  });

  it("detects snippets that reference a table", () => {
    for (const snippet of DEFAULT_SQL_SNIPPETS) {
      expect(snippetReferencesTable(snippet.sql)).toBe(true);
    }
    expect(snippetReferencesTable("SELECT 1")).toBe(false);
  });
});
