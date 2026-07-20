import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearStoredOpenAiApiKey,
  getStoredOpenAiApiKey,
  hasStoredOpenAiApiKey,
  looksLikeOpenAiApiKey,
  OPENAI_API_KEY_STORAGE_KEY,
  setStoredOpenAiApiKey,
} from "./ai-byok.ts";

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

describe("getStoredOpenAiApiKey / setStoredOpenAiApiKey", () => {
  it("returns null when nothing stored", () => {
    expect(getStoredOpenAiApiKey()).toBeNull();
    expect(hasStoredOpenAiApiKey()).toBe(false);
  });

  it("round-trips a key", () => {
    setStoredOpenAiApiKey("sk-test-key-1234567890");
    expect(getStoredOpenAiApiKey()).toBe("sk-test-key-1234567890");
    expect(hasStoredOpenAiApiKey()).toBe(true);
  });

  it("trims whitespace on write and read", () => {
    setStoredOpenAiApiKey("  sk-test-key-1234567890  ");
    expect(getStoredOpenAiApiKey()).toBe("sk-test-key-1234567890");
  });

  it("clears when empty string is written", () => {
    setStoredOpenAiApiKey("sk-test-key-1234567890");
    setStoredOpenAiApiKey("   ");
    expect(getStoredOpenAiApiKey()).toBeNull();
  });

  it("clearStoredOpenAiApiKey removes the key", () => {
    setStoredOpenAiApiKey("sk-test-key-1234567890");
    clearStoredOpenAiApiKey();
    expect(getStoredOpenAiApiKey()).toBeNull();
  });

  it("ignores corrupt JSON and non-strings", () => {
    window.localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, "{not-json");
    expect(getStoredOpenAiApiKey()).toBeNull();

    window.localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, JSON.stringify(42));
    expect(getStoredOpenAiApiKey()).toBeNull();

    window.localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, JSON.stringify(""));
    expect(getStoredOpenAiApiKey()).toBeNull();
  });

  it("returns null when window is unavailable", () => {
    // @ts-expect-error cleanup test polyfill
    delete globalThis.window;
    expect(getStoredOpenAiApiKey()).toBeNull();
    expect(hasStoredOpenAiApiKey()).toBe(false);
  });
});

describe("looksLikeOpenAiApiKey", () => {
  it("accepts sk- keys of sufficient length", () => {
    expect(looksLikeOpenAiApiKey("sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
  });

  it("rejects short or wrong-prefix values", () => {
    expect(looksLikeOpenAiApiKey("sk-short")).toBe(false);
    expect(looksLikeOpenAiApiKey("pk-abcdefghijklmnopqrstuvwxyz")).toBe(false);
    expect(looksLikeOpenAiApiKey("")).toBe(false);
  });
});
