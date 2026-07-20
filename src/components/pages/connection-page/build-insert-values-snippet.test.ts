import { describe, expect, it } from "vitest";

import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import {
  buildInsertValuesSnippet,
  isAfterInsertIntoTable,
  isAfterIntoKeyword,
} from "./build-insert-values-snippet.ts";

const col = (partial: Partial<TableColumnMetadata> & { name: string }): TableColumnMetadata => ({
  dataType: "varchar",
  nullable: true,
  primaryKey: false,
  unique: false,
  defaultValue: null,
  isForeignKey: false,
  ...partial,
});

describe("buildInsertValuesSnippet", () => {
  it("builds columns VALUES from metadata", () => {
    const snippet = buildInsertValuesSnippet([
      col({ name: "id", dataType: "serial", nullable: false, primaryKey: true }),
      col({ name: "email", dataType: "varchar", nullable: false }),
      col({ name: "age", dataType: "integer", nullable: true }),
      col({ name: "active", dataType: "boolean", nullable: false }),
    ]);

    expect(snippet).toEqual({
      label: "(columns) VALUES (...)",
      detail: "Insert 3 columns",
      insertText: `("email", "age", "active") VALUES ('', NULL, FALSE)`,
    });
  });

  it("uses DEFAULT when column has a default", () => {
    const snippet = buildInsertValuesSnippet([
      col({ name: "status", dataType: "varchar", nullable: false, defaultValue: "'active'" }),
    ]);
    expect(snippet?.insertText).toBe(`("status") VALUES (DEFAULT)`);
  });

  it("returns null when only auto-generated columns", () => {
    expect(
      buildInsertValuesSnippet([
        col({ name: "id", dataType: "serial", nullable: false, primaryKey: true }),
      ]),
    ).toBeNull();
  });
});

describe("isAfterIntoKeyword", () => {
  it("matches after INTO", () => {
    expect(isAfterIntoKeyword("INSERT INTO ")).toBe(true);
    expect(isAfterIntoKeyword("INSERT INTO us")).toBe(true);
    expect(isAfterIntoKeyword("SELECT * FROM ")).toBe(false);
  });
});

describe("isAfterInsertIntoTable", () => {
  it("matches after INTO table ", () => {
    expect(isAfterInsertIntoTable("INSERT INTO users ")).toBe(true);
    expect(isAfterInsertIntoTable('INSERT INTO "public"."users" ')).toBe(true);
    expect(isAfterInsertIntoTable("INSERT INTO ")).toBe(false);
    expect(isAfterInsertIntoTable("SELECT * FROM users ")).toBe(false);
  });
});
