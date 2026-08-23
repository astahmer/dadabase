import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getStoredConnectionLayoutSize,
  setStoredConnectionLayoutSize,
} from "./connection-layout-preferences.ts";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connection layout preferences", () => {
  it("uses the fallback when local storage has no valid size", () => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage });

    expect(getStoredConnectionLayoutSize("connection-1", "sidebar", 15)).toBe(15);
    localStorage.setItem("dadabase.connection-layout.connection-1.sidebar", JSON.stringify(101));
    expect(getStoredConnectionLayoutSize("connection-1", "sidebar", 15)).toBe(15);
  });

  it("persists valid panel sizes by connection and pane", () => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage });

    setStoredConnectionLayoutSize("connection-1", "sidebar", 22);
    setStoredConnectionLayoutSize("connection-1", "query-logger", 18);

    expect(getStoredConnectionLayoutSize("connection-1", "sidebar", 15)).toBe(22);
    expect(getStoredConnectionLayoutSize("connection-1", "query-logger", 0)).toBe(18);
  });
});
