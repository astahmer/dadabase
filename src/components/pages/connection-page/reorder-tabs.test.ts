import { describe, expect, it } from "vitest";

import { reorderTabs } from "./reorder-tabs.ts";

describe("reorderTabs", () => {
  const tabs = [{ tabId: "a" }, { tabId: "b" }, { tabId: "c" }, { tabId: "d" }];

  it("moves a tab forward", () => {
    expect(reorderTabs(tabs, "a", "c").map((t) => t.tabId)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a tab backward", () => {
    expect(reorderTabs(tabs, "d", "b").map((t) => t.tabId)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns a copy when ids match", () => {
    const result = reorderTabs(tabs, "b", "b");
    expect(result).toEqual(tabs);
    expect(result).not.toBe(tabs);
  });

  it("returns a copy when active id is missing", () => {
    const result = reorderTabs(tabs, "missing", "b");
    expect(result).toEqual(tabs);
    expect(result).not.toBe(tabs);
  });

  it("returns a copy when over id is missing", () => {
    const result = reorderTabs(tabs, "a", "missing");
    expect(result).toEqual(tabs);
    expect(result).not.toBe(tabs);
  });

  it("preserves extra tab fields", () => {
    const rich = [
      { tabId: "a", table: "users" },
      { tabId: "b", table: "orders" },
    ];
    expect(reorderTabs(rich, "a", "b")).toEqual([
      { tabId: "b", table: "orders" },
      { tabId: "a", table: "users" },
    ]);
  });
});
