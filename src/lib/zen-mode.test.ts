import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStoredZenMode,
  isZenModeEnabled,
  setStoredZenMode,
  toggleZenModeValue,
  ZEN_MODE_STORAGE_KEY,
} from "./zen-mode.ts";

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

describe("getStoredZenMode / setStoredZenMode", () => {
  it("returns false when nothing stored", () => {
    expect(getStoredZenMode()).toBe(false);
  });

  it("round-trips true", () => {
    setStoredZenMode(true);
    expect(getStoredZenMode()).toBe(true);
  });

  it("round-trips false", () => {
    setStoredZenMode(true);
    setStoredZenMode(false);
    expect(getStoredZenMode()).toBe(false);
  });

  it("ignores corrupt JSON and non-booleans", () => {
    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, "{not-json");
    expect(getStoredZenMode()).toBe(false);

    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, JSON.stringify("true"));
    expect(getStoredZenMode()).toBe(false);

    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, JSON.stringify(1));
    expect(getStoredZenMode()).toBe(false);

    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, JSON.stringify(null));
    expect(getStoredZenMode()).toBe(false);
  });

  it("returns false when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(getStoredZenMode()).toBe(false);
  });
});

describe("isZenModeEnabled", () => {
  it("prefers explicit search param over storage", () => {
    setStoredZenMode(true);
    expect(isZenModeEnabled(false)).toBe(false);
    setStoredZenMode(false);
    expect(isZenModeEnabled(true)).toBe(true);
  });

  it("falls back to storage when search param is undefined", () => {
    expect(isZenModeEnabled(undefined)).toBe(false);
    setStoredZenMode(true);
    expect(isZenModeEnabled(undefined)).toBe(true);
  });
});

describe("toggleZenModeValue", () => {
  it("flips the value", () => {
    expect(toggleZenModeValue(false)).toBe(true);
    expect(toggleZenModeValue(true)).toBe(false);
  });
});
