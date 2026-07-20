import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_LIMIT,
  getStoredPageLimit,
  MAX_PAGE_LIMIT,
  PAGE_LIMIT_STORAGE_KEY,
  setStoredPageLimit,
} from "./default-page-limit.ts";

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

describe("getStoredPageLimit / setStoredPageLimit", () => {
  it("returns default when nothing stored", () => {
    expect(getStoredPageLimit()).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("round-trips a valid limit", () => {
    setStoredPageLimit(100);
    expect(getStoredPageLimit()).toBe(100);
  });

  it("clamps values below the minimum to 1", () => {
    setStoredPageLimit(0);
    expect(getStoredPageLimit()).toBe(1);
    setStoredPageLimit(-10);
    expect(getStoredPageLimit()).toBe(1);
  });

  it("clamps values above the maximum", () => {
    setStoredPageLimit(MAX_PAGE_LIMIT + 50);
    expect(getStoredPageLimit()).toBe(MAX_PAGE_LIMIT);
  });

  it("floors fractional values", () => {
    setStoredPageLimit(99.7);
    expect(getStoredPageLimit()).toBe(99);
  });

  it("ignores corrupt JSON and non-numbers", () => {
    window.localStorage.setItem(PAGE_LIMIT_STORAGE_KEY, "{not-json");
    expect(getStoredPageLimit()).toBe(DEFAULT_PAGE_LIMIT);

    window.localStorage.setItem(PAGE_LIMIT_STORAGE_KEY, JSON.stringify("100"));
    expect(getStoredPageLimit()).toBe(DEFAULT_PAGE_LIMIT);

    window.localStorage.setItem(PAGE_LIMIT_STORAGE_KEY, JSON.stringify(null));
    expect(getStoredPageLimit()).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("returns default when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(getStoredPageLimit()).toBe(DEFAULT_PAGE_LIMIT);
  });
});
