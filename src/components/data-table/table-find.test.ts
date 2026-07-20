import { describe, expect, it } from "vitest";

import {
  buildFindMatchCellKeys,
  cellValueMatchesQuery,
  cellValueToSearchText,
  filterRowsByFindQuery,
  findMatchCellKey,
  getMatchingColumnIds,
  normalizeFindQuery,
  rowMatchesFindQuery,
} from "./table-find.ts";

describe("normalizeFindQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeFindQuery("  Foo ")).toBe("foo");
  });
});

describe("cellValueToSearchText", () => {
  it("handles primitives and null", () => {
    expect(cellValueToSearchText(null)).toBe("");
    expect(cellValueToSearchText(undefined)).toBe("");
    expect(cellValueToSearchText("hi")).toBe("hi");
    expect(cellValueToSearchText(42)).toBe("42");
    expect(cellValueToSearchText(true)).toBe("true");
  });

  it("json-stringifies objects", () => {
    expect(cellValueToSearchText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("cellValueMatchesQuery", () => {
  it("matches case-insensitive substring", () => {
    expect(cellValueMatchesQuery("Alice", "ali")).toBe(true);
    expect(cellValueMatchesQuery("Alice", "BOB")).toBe(false);
  });

  it("returns false for empty query", () => {
    expect(cellValueMatchesQuery("Alice", "  ")).toBe(false);
  });
});

describe("rowMatchesFindQuery", () => {
  const row = { name: "Alice", email: "a@x.com", age: 30 };

  it("matches any column by default", () => {
    expect(rowMatchesFindQuery(row, "x.com")).toBe(true);
    expect(rowMatchesFindQuery(row, "zzz")).toBe(false);
  });

  it("respects columnIds allowlist", () => {
    expect(rowMatchesFindQuery(row, "x.com", ["name"])).toBe(false);
    expect(rowMatchesFindQuery(row, "ali", ["name"])).toBe(true);
  });
});

describe("getMatchingColumnIds", () => {
  it("returns only matching columns", () => {
    expect(getMatchingColumnIds({ a: "foo", b: "bar", c: "foobar" }, "foo")).toEqual(["a", "c"]);
  });
});

describe("filterRowsByFindQuery", () => {
  const rows = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Alicia" },
  ];

  it("filters matching rows", () => {
    expect(filterRowsByFindQuery(rows, "alic").map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("returns all rows when query empty", () => {
    expect(filterRowsByFindQuery(rows, "")).toEqual(rows);
  });
});

describe("buildFindMatchCellKeys", () => {
  it("builds rowId::columnId keys", () => {
    const keys = buildFindMatchCellKeys(
      [
        { id: "r1", original: { name: "Alice", city: "Paris" } },
        { id: "r2", original: { name: "Bob", city: "Lyon" } },
      ],
      "ali",
    );
    expect(keys.has(findMatchCellKey("r1", "name"))).toBe(true);
    expect(keys.has(findMatchCellKey("r1", "city"))).toBe(false);
    expect(keys.size).toBe(1);
  });
});
