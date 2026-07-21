import { describe, expect, it } from "vitest";

import { parsePasteRows } from "./paste-rows.ts";

describe("parsePasteRows", () => {
  it("returns empty result for empty input", () => {
    expect(parsePasteRows("")).toEqual({ columns: [], rows: [], hasHeader: false });
  });

  it("detects a header row when it matches known columns", () => {
    const result = parsePasteRows("id\tname\n1\tAda\n2\tGrace", ["id", "name"]);
    expect(result.hasHeader).toBe(true);
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Grace" },
    ]);
  });

  it("matches header case/space-insensitively", () => {
    const result = parsePasteRows("ID \t Name\n1\tAda", ["id", "name"]);
    expect(result.hasHeader).toBe(true);
    expect(result.rows).toEqual([{ ID: "1", Name: "Ada" }]);
  });

  it("treats all rows as data when the first row does not match known columns", () => {
    const result = parsePasteRows("1\tAda\n2\tGrace", ["id", "name"]);
    expect(result.hasHeader).toBe(false);
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Grace" },
    ]);
  });

  it("generates generic column names when knownColumns is omitted", () => {
    const result = parsePasteRows("1\tAda\n2\tGrace");
    expect(result.hasHeader).toBe(false);
    expect(result.columns).toEqual(["column_1", "column_2"]);
    expect(result.rows).toEqual([
      { column_1: "1", column_2: "Ada" },
      { column_1: "2", column_2: "Grace" },
    ]);
  });

  it("auto-detects comma delimiter when no tabs are present", () => {
    const result = parsePasteRows("id,name\n1,Ada", ["id", "name"]);
    expect(result.hasHeader).toBe(true);
    expect(result.rows).toEqual([{ id: "1", name: "Ada" }]);
  });

  it("prefers tab delimiter when both tabs and commas are present", () => {
    const result = parsePasteRows("id\tname\n1\tAda, Grace", ["id", "name"]);
    expect(result.rows).toEqual([{ id: "1", name: "Ada, Grace" }]);
  });

  it("pads generic column names when a data row is wider than knownColumns", () => {
    const result = parsePasteRows("1\tAda\tExtra", ["id", "name"]);
    expect(result.columns).toEqual(["id", "name", "column_3"]);
    expect(result.rows).toEqual([{ id: "1", name: "Ada", column_3: "Extra" }]);
  });

  it("handles quoted fields with embedded delimiters", () => {
    const result = parsePasteRows('id\tname\n1\t"Ada, the great"', ["id", "name"]);
    expect(result.rows).toEqual([{ id: "1", name: "Ada, the great" }]);
  });
});
