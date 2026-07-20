import { describe, expect, it } from "vitest";

import {
  addGroupByColumn,
  clearGroupByColumns,
  HAVING_EXPRESSION_SUGGESTIONS,
  removeGroupByColumn,
  toggleGroupByColumn,
} from "./group-by-columns.ts";

describe("group-by-columns helpers", () => {
  it("adds a column", () => {
    expect(addGroupByColumn(undefined, "status")).toEqual(["status"]);
    expect(addGroupByColumn(["status"], "department")).toEqual(["status", "department"]);
  });

  it("does not duplicate columns", () => {
    expect(addGroupByColumn(["status"], "status")).toEqual(["status"]);
  });

  it("ignores blank columns", () => {
    expect(addGroupByColumn(["status"], "  ")).toEqual(["status"]);
  });

  it("removes a column", () => {
    expect(removeGroupByColumn(["status", "department"], "status")).toEqual(["department"]);
    expect(removeGroupByColumn(undefined, "status")).toEqual([]);
  });

  it("toggles a column", () => {
    expect(toggleGroupByColumn([], "status")).toEqual(["status"]);
    expect(toggleGroupByColumn(["status"], "status")).toEqual([]);
  });

  it("clears columns", () => {
    expect(clearGroupByColumns()).toEqual([]);
  });

  it("exposes having expression suggestions", () => {
    expect(HAVING_EXPRESSION_SUGGESTIONS).toContain("COUNT(*)");
  });
});
