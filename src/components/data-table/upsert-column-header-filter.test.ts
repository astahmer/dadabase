import { describe, expect, it } from "vitest";

import { getColumnHeaderFilter, upsertColumnHeaderFilter } from "./upsert-column-header-filter.ts";

describe("upsertColumnHeaderFilter", () => {
  it("adds a contains filter when column has none", () => {
    const next = upsertColumnHeaderFilter([], {
      column: "name",
      operator: "contains",
      value: "alice",
    });
    expect(next).toEqual([{ column: "name", operator: "contains", value: "alice" }]);
  });

  it("updates existing equals/contains for the same column", () => {
    const next = upsertColumnHeaderFilter(
      [
        { column: "name", operator: "equals", value: "bob" },
        { column: "age", operator: "equals", value: "30" },
      ],
      { column: "name", operator: "contains", value: "al" },
    );
    expect(next).toEqual([
      { column: "age", operator: "equals", value: "30" },
      { column: "name", operator: "contains", value: "al" },
    ]);
  });

  it("removes equals/contains when value is empty", () => {
    const next = upsertColumnHeaderFilter(
      [
        { column: "name", operator: "contains", value: "x" },
        { column: "status", operator: "equals", value: "active" },
      ],
      { column: "name", operator: "contains", value: "  " },
    );
    expect(next).toEqual([{ column: "status", operator: "equals", value: "active" }]);
  });

  it("leaves inverted / other operators on same column alone", () => {
    const next = upsertColumnHeaderFilter(
      [
        { column: "name", operator: "starts_with", value: "A" },
        { column: "name", operator: "equals", value: "Bob", inverted: true },
      ],
      { column: "name", operator: "equals", value: "Alice" },
    );
    expect(next).toEqual([
      { column: "name", operator: "starts_with", value: "A" },
      { column: "name", operator: "equals", value: "Bob", inverted: true },
      { column: "name", operator: "equals", value: "Alice" },
    ]);
  });
});

describe("getColumnHeaderFilter", () => {
  it("returns active equals/contains filter", () => {
    expect(
      getColumnHeaderFilter([{ column: "email", operator: "contains", value: "@" }], "email"),
    ).toEqual({ column: "email", operator: "contains", value: "@" });
  });

  it("returns undefined when no matching filter", () => {
    expect(getColumnHeaderFilter([{ column: "age", operator: "equals", value: "1" }], "name")).toBe(
      undefined,
    );
  });
});
