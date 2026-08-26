import { beforeEach, expect, test, vi } from "vitest";

import {
  getStoredByokConfig,
  setStoredByokConfig,
} from "./ai-byok.ts";

/**
 * localStorage stub — ai-byok only touches `window.localStorage`, so a plain
 * Map-backed fake avoids pulling jsdom into the unit suite.
 */
const createStorageStub = () => {
  const backing = new Map<string, string>();
  const storage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
  };
  return { storage, backing };
};

const installWindow = () => {
  const { storage, backing } = createStorageStub();
  vi.stubGlobal("window", { localStorage: storage });
  return backing;
};

let backing: Map<string, string>;

beforeEach(() => {
  vi.restoreAllMocks();
  backing = installWindow();
});


test("legacy bare-string API keys migrate to the provider config shape", () => {
  // Pre-providers builds stored JSON.stringify(apiKey) — a quoted string.
  backing.set("dadabase.openai-api-key", JSON.stringify("sk-legacy-key"));

  const config = getStoredByokConfig();

  expect(config).toEqual({ providerId: "openai", apiKey: "sk-legacy-key" });
  // The rewrite happens immediately so both formats never coexist.
  expect(JSON.parse(backing.get("dadabase.openai-api-key") ?? "")).toEqual({
    providerId: "openai",
    apiKey: "sk-legacy-key",
  });
});

test("legacy empty string is treated as no config", () => {
  backing.set("dadabase.openai-api-key", JSON.stringify("   "));
  expect(getStoredByokConfig()).toBeNull();
});

test("keyless local providers yield a usable config without an API key", () => {
  backing.set(
    "dadabase.openai-api-key",
    JSON.stringify({ providerId: "ollama-local", apiKey: "", model: "llama3" }),
  );
  expect(getStoredByokConfig()).toEqual({
    providerId: "ollama-local",
    baseUrl: undefined,
    apiKey: "",
    model: "llama3",
    enabledTools: undefined,
  });
});

test("hosted providers without an API key are rejected", () => {
  backing.set(
    "dadabase.openai-api-key",
    JSON.stringify({ providerId: "openai", apiKey: "" }),
  );
  expect(getStoredByokConfig()).toBeNull();
});

test("custom providers require an explicit base url", () => {
  backing.set(
    "dadabase.openai-api-key",
    JSON.stringify({ providerId: "custom", apiKey: "", baseUrl: "" }),
  );
  // Custom is key-optional, but with no URL and no key there is nothing to
  // talk to — the config survives read-side, save-side refuses via canSave.
  const config = getStoredByokConfig();
  expect(config?.providerId).toBe("custom");
});

test("saving a keyless local preset keeps the config alive for send gating", () => {
  setStoredByokConfig({ providerId: "lmstudio-local", apiKey: "" });
  expect(getStoredByokConfig()?.providerId).toBe("lmstudio-local");
});
