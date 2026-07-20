import { describe, expect, it } from "vitest";

import {
  hiddenColumnRefsFromKeys,
  isColumnHidden,
  normalizeHiddenColumnList,
  parseHiddenColumnString,
  toHiddenColumnKey,
  toHiddenColumnKeys,
} from "./hidden-column-list.ts";

describe("parseHiddenColumnString", () => {
  it("parses bare column names", () => {
    expect(parseHiddenColumnString("id")).toEqual({ table: "", column: "id" });
  });

  it("parses qualified names", () => {
    expect(parseHiddenColumnString("users.id")).toEqual({ table: "users", column: "id" });
  });

  it("uses the last dot for nested-looking names", () => {
    expect(parseHiddenColumnString("public.users.id")).toEqual({
      table: "public.users",
      column: "id",
    });
  });
});

describe("normalizeHiddenColumnList", () => {
  it("returns empty for non-arrays", () => {
    expect(normalizeHiddenColumnList(null)).toEqual([]);
    expect(normalizeHiddenColumnList(undefined)).toEqual([]);
    expect(normalizeHiddenColumnList("id")).toEqual([]);
  });

  it("migrates legacy string lists", () => {
    expect(normalizeHiddenColumnList(["id", "users.name"])).toEqual([
      { table: "", column: "id" },
      { table: "users", column: "name" },
    ]);
  });

  it("applies defaultTable to bare legacy strings", () => {
    expect(normalizeHiddenColumnList(["id", "orders.total"], "users")).toEqual([
      { table: "users", column: "id" },
      { table: "orders", column: "total" },
    ]);
  });

  it("keeps object entries and fills missing table", () => {
    expect(
      normalizeHiddenColumnList(
        [{ table: "users", column: "id" }, { column: "email" }, { table: "", column: "age" }],
        "users",
      ),
    ).toEqual([
      { table: "users", column: "id" },
      { table: "users", column: "email" },
      { table: "users", column: "age" },
    ]);
  });

  it("skips invalid entries", () => {
    expect(normalizeHiddenColumnList([null, 1, {}, { column: "" }, "ok"])).toEqual([
      { table: "", column: "ok" },
    ]);
  });
});

describe("toHiddenColumnKey / keys", () => {
  it("formats bare and qualified keys", () => {
    expect(toHiddenColumnKey({ table: "", column: "id" })).toBe("id");
    expect(toHiddenColumnKey({ table: "users", column: "id" })).toBe("users.id");
    expect(
      toHiddenColumnKeys([
        { table: "", column: "id" },
        { table: "users", column: "name" },
      ]),
    ).toEqual(["id", "users.name"]);
  });
});

describe("hiddenColumnRefsFromKeys", () => {
  it("builds refs from table column ids", () => {
    expect(hiddenColumnRefsFromKeys(["id", "orders.total"], "users")).toEqual([
      { table: "users", column: "id" },
      { table: "orders", column: "total" },
    ]);
  });
});

describe("isColumnHidden", () => {
  const hidden = [
    { table: "", column: "age" },
    { table: "orders", column: "total" },
  ];

  it("matches bare refs against bare and qualified ids", () => {
    expect(isColumnHidden(hidden, "age")).toBe(true);
    expect(isColumnHidden(hidden, "users.age")).toBe(true);
  });

  it("requires table match for qualified refs", () => {
    expect(isColumnHidden(hidden, "orders.total")).toBe(true);
    expect(isColumnHidden(hidden, "total")).toBe(true);
    expect(isColumnHidden(hidden, "users.total")).toBe(false);
  });

  it("returns false for visible columns", () => {
    expect(isColumnHidden(hidden, "id")).toBe(false);
  });
});
