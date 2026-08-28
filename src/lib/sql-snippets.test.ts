import { describe, expect, it } from "vitest";

import {
  resolveSnippetSchemaSql,
  snippetReferencesColumn,
  snippetReferencesTable,
  SNIPPET_COLUMN_TOKEN,
  SNIPPET_TABLE_TOKEN,
} from "./sql-snippets.ts";

describe("SQL snippet schema tokens", () => {
  it("resolves table and column tokens together", () => {
    expect(
      resolveSnippetSchemaSql(
        `SELECT ${SNIPPET_COLUMN_TOKEN} FROM ${SNIPPET_TABLE_TOKEN}`,
        "public.users",
        "display_name",
      ),
    ).toBe("SELECT display_name FROM public.users");
  });

  it("reports which schema tokens a snippet uses", () => {
    expect(snippetReferencesTable(`SELECT * FROM ${SNIPPET_TABLE_TOKEN}`)).toBe(true);
    expect(snippetReferencesColumn(`SELECT ${SNIPPET_COLUMN_TOKEN}`)).toBe(true);
    expect(snippetReferencesColumn("SELECT * FROM users")).toBe(false);
  });
});
