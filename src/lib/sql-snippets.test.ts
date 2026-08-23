import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addSqlSnippet,
  DEFAULT_SQL_SNIPPETS,
  deleteSqlSnippet,
  ensureSqlSnippetsSeeded,
  getSqlSnippets,
  resetSqlSnippets,
  setSqlSnippets,
  SQL_SNIPPETS_STORAGE_KEY,
  updateSqlSnippet,
} from "./sql-snippets.ts";

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: createMemoryStorage() },
    writable: true,
  });
});

afterEach(() => {
  // @ts-expect-error cleanup test polyfill
  delete globalThis.window;
});

describe("getSqlSnippets / setSqlSnippets", () => {
  it("returns seeded defaults when nothing stored", () => {
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);
  });

  it("round-trips custom snippets", () => {
    const custom = [{ id: "a", name: "Mine", sql: "SELECT 1" }];
    setSqlSnippets(custom);
    expect(getSqlSnippets()).toEqual(custom);
  });

  it("falls back to defaults on corrupt JSON or invalid shape", () => {
    window.localStorage.setItem(SQL_SNIPPETS_STORAGE_KEY, "{not-json");
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);

    window.localStorage.setItem(SQL_SNIPPETS_STORAGE_KEY, JSON.stringify("nope"));
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);

    window.localStorage.setItem(
      SQL_SNIPPETS_STORAGE_KEY,
      JSON.stringify([{ id: 1, name: "bad", sql: "x" }]),
    );
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);
  });

  it("returns defaults when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);
  });
});

describe("ensureSqlSnippetsSeeded", () => {
  it("writes defaults when storage is empty", () => {
    const snippets = ensureSqlSnippetsSeeded();
    expect(snippets).toEqual([...DEFAULT_SQL_SNIPPETS]);
    expect(window.localStorage.getItem(SQL_SNIPPETS_STORAGE_KEY)).toBe(
      JSON.stringify(DEFAULT_SQL_SNIPPETS),
    );
  });

  it("does not overwrite existing valid snippets", () => {
    const custom = [{ id: "c", name: "Custom", sql: "SELECT 2" }];
    setSqlSnippets(custom);
    expect(ensureSqlSnippetsSeeded()).toEqual(custom);
  });

  it("upgrades built-in snippets while preserving custom snippets", () => {
    const legacyAndCustom = [
      { id: "default-select-star", name: "Select *", sql: "SELECT * FROM " },
      { id: "mine", name: "Forensics", sql: "SELECT 42" },
    ];
    setSqlSnippets(legacyAndCustom);

    expect(ensureSqlSnippetsSeeded()).toEqual([
      DEFAULT_SQL_SNIPPETS[0],
      { id: "mine", name: "Forensics", sql: "SELECT 42" },
    ]);
  });
});

describe("CRUD", () => {
  it("adds a snippet", () => {
    const added = addSqlSnippet({ name: "  My query  ", sql: "SELECT 42" });
    expect(added.name).toBe("My query");
    expect(added.sql).toBe("SELECT 42");
    expect(getSqlSnippets()).toContainEqual(added);
  });

  it("updates a snippet by id", () => {
    const added = addSqlSnippet({ name: "Old", sql: "SELECT 1" });
    const updated = updateSqlSnippet(added.id, { name: "New", sql: "SELECT 2" });
    expect(updated).toEqual({ id: added.id, name: "New", sql: "SELECT 2" });
    expect(getSqlSnippets().find((s) => s.id === added.id)).toEqual(updated);
  });

  it("returns null when updating missing id", () => {
    expect(updateSqlSnippet("missing", { name: "x" })).toBeNull();
  });

  it("deletes a snippet by id", () => {
    const added = addSqlSnippet({ name: "Temp", sql: "SELECT 1" });
    expect(deleteSqlSnippet(added.id)).toBe(true);
    expect(getSqlSnippets().find((s) => s.id === added.id)).toBeUndefined();
    expect(deleteSqlSnippet(added.id)).toBe(false);
  });

  it("resets to defaults", () => {
    setSqlSnippets([{ id: "x", name: "X", sql: "SELECT 1" }]);
    expect(resetSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);
    expect(getSqlSnippets()).toEqual([...DEFAULT_SQL_SNIPPETS]);
  });
});
