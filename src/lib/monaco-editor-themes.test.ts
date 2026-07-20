import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defineCustomMonacoThemes,
  EDITOR_THEME_CHANGE_EVENT,
  EDITOR_THEME_STORAGE_KEY,
  getStoredEditorTheme,
  listCustomEditorThemes,
  listEditorThemes,
  resolveEditorTheme,
  setStoredEditorTheme,
} from "./monaco-editor-themes.ts";

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
    value: {
      localStorage: createMemoryStorage(),
      dispatchEvent: vi.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  // @ts-expect-error cleanup test polyfill
  delete globalThis.window;
});

describe("listEditorThemes", () => {
  it("includes auto plus built-in and custom themes", () => {
    const ids = listEditorThemes().map((t) => t.id);
    expect(ids).toEqual(["auto", "vs", "vs-dark", "one-dark-pro", "github-light", "github-dark"]);
  });
});

describe("listCustomEditorThemes", () => {
  it("only returns themes with defineTheme data", () => {
    const customs = listCustomEditorThemes();
    expect(customs.every((t) => t.data != null)).toBe(true);
    expect(customs.map((t) => t.id)).toEqual(["one-dark-pro", "github-light", "github-dark"]);
  });
});

describe("getStoredEditorTheme / setStoredEditorTheme", () => {
  it("defaults to auto when nothing stored", () => {
    expect(getStoredEditorTheme()).toBe("auto");
  });

  it("round-trips a preference", () => {
    setStoredEditorTheme("one-dark-pro");
    expect(getStoredEditorTheme()).toBe("one-dark-pro");
    expect(window.localStorage.getItem(EDITOR_THEME_STORAGE_KEY)).toBe(
      JSON.stringify("one-dark-pro"),
    );
  });

  it("dispatches a change event on set", () => {
    setStoredEditorTheme("github-dark");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EDITOR_THEME_CHANGE_EVENT,
      }),
    );
  });

  it("ignores corrupt JSON and unknown ids", () => {
    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, "{not-json");
    expect(getStoredEditorTheme()).toBe("auto");

    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, JSON.stringify("not-a-theme"));
    expect(getStoredEditorTheme()).toBe("auto");

    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, JSON.stringify(1));
    expect(getStoredEditorTheme()).toBe("auto");

    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, JSON.stringify(null));
    expect(getStoredEditorTheme()).toBe("auto");
  });

  it("returns auto when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(getStoredEditorTheme()).toBe("auto");
  });

  it("no-ops set when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(() => setStoredEditorTheme("vs-dark")).not.toThrow();
  });
});

describe("resolveEditorTheme", () => {
  it("prefers matching light/dark when auto", () => {
    expect(resolveEditorTheme("auto", false)).toBe("vs");
    expect(resolveEditorTheme("auto", true)).toBe("vs-dark");
  });

  it("returns an explicit theme regardless of isDark", () => {
    expect(resolveEditorTheme("github-light", true)).toBe("github-light");
    expect(resolveEditorTheme("one-dark-pro", false)).toBe("one-dark-pro");
    expect(resolveEditorTheme("vs", true)).toBe("vs");
    expect(resolveEditorTheme("vs-dark", false)).toBe("vs-dark");
  });

  it("falls back to vs / vs-dark for unknown ids", () => {
    // @ts-expect-error intentional invalid id
    expect(resolveEditorTheme("nope", false)).toBe("vs");
    // @ts-expect-error intentional invalid id
    expect(resolveEditorTheme("nope", true)).toBe("vs-dark");
  });
});

describe("defineCustomMonacoThemes", () => {
  it("registers each custom theme", () => {
    const defineTheme = vi.fn();
    defineCustomMonacoThemes({ editor: { defineTheme } });
    expect(defineTheme).toHaveBeenCalledTimes(3);
    expect(defineTheme.mock.calls.map((c) => c[0])).toEqual([
      "one-dark-pro",
      "github-light",
      "github-dark",
    ]);
    for (const call of defineTheme.mock.calls) {
      expect(call[1]).toMatchObject({
        base: expect.any(String),
        inherit: true,
        colors: expect.any(Object),
      });
    }
  });
});
