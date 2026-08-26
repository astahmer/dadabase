import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isQueryHistoryOptOut,
  queryHistorySkipFlag,
  setQueryHistoryOptOut,
} from "./query-history-settings.ts";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("query-history-settings", () => {
  it("defaults to recording (no opt-out)", () => {
    expect(isQueryHistoryOptOut()).toBe(false);
    expect(queryHistorySkipFlag()).toEqual({ skipQueryLog: false });
  });

  it("round-trips the opt-out flag", () => {
    setQueryHistoryOptOut(true);
    expect(isQueryHistoryOptOut()).toBe(true);
    expect(queryHistorySkipFlag()).toEqual({ skipQueryLog: true });
    setQueryHistoryOptOut(false);
    expect(isQueryHistoryOptOut()).toBe(false);
  });
});
