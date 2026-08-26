import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_PRESETS,
  CUSTOM_PROVIDER_ID,
  getAiProviderPreset,
  isProviderKeyOptional,
  resolveChatBaseUrl,
} from "./ai-providers.ts";

describe("AI_PROVIDER_PRESETS", () => {
  it("has unique ids", () => {
    const ids = AI_PROVIDER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the expected providers", () => {
    const ids = AI_PROVIDER_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "openai",
      "openrouter",
      "groq",
      "mistral",
      "deepseek",
      "together",
      "xai",
      "ollama-local",
      "lmstudio-local",
      CUSTOM_PROVIDER_ID,
    ]);
  });

  it("uses https for hosted providers and http localhost for local ones", () => {
    for (const preset of AI_PROVIDER_PRESETS) {
      if (preset.id === CUSTOM_PROVIDER_ID) {
        expect(preset.defaultBaseUrl).toBe("");
        continue;
      }
      if (preset.keyOptional) {
        expect(preset.defaultBaseUrl.startsWith("http://localhost")).toBe(true);
      } else {
        expect(preset.defaultBaseUrl.startsWith("https://")).toBe(true);
      }
    }
  });

  it("marks local runtimes as key-optional", () => {
    expect(getAiProviderPreset("ollama-local")?.keyOptional).toBe(true);
    expect(getAiProviderPreset("lmstudio-local")?.keyOptional).toBe(true);
    expect(getAiProviderPreset("openai")?.keyOptional).toBe(false);
    expect(getAiProviderPreset(CUSTOM_PROVIDER_ID)?.keyOptional).toBe(true);
  });
});

describe("getAiProviderPreset", () => {
  it("resolves by id and returns undefined for unknown / nullish ids", () => {
    expect(getAiProviderPreset("openrouter")?.label).toBe("OpenRouter");
    expect(getAiProviderPreset("nope")).toBeUndefined();
    expect(getAiProviderPreset(undefined)).toBeUndefined();
    expect(getAiProviderPreset(null)).toBeUndefined();
  });
});

describe("resolveChatBaseUrl", () => {
  it("prefers an explicit non-empty base URL over the preset default", () => {
    expect(
      resolveChatBaseUrl({ providerId: "openai", baseUrl: "https://proxy.example.com/v1" }),
    ).toBe("https://proxy.example.com/v1");
  });

  it("falls back to the preset default base URL", () => {
    expect(resolveChatBaseUrl({ providerId: "groq" })).toBe("https://api.groq.com/openai/v1");
    expect(resolveChatBaseUrl({ providerId: "groq", baseUrl: "  " })).toBe(
      "https://api.groq.com/openai/v1",
    );
  });

  it("returns undefined only when nothing can be resolved (custom with no URL)", () => {
    expect(resolveChatBaseUrl({ providerId: CUSTOM_PROVIDER_ID })).toBeUndefined();
    // openai resolves to its explicit preset default.
    expect(resolveChatBaseUrl({ providerId: "openai" })).toBe("https://api.openai.com/v1");
    expect(resolveChatBaseUrl({})).toBeUndefined();
  });
});

describe("isProviderKeyOptional", () => {
  it("is true only for local/custom providers", () => {
    expect(isProviderKeyOptional("ollama-local")).toBe(true);
    expect(isProviderKeyOptional(CUSTOM_PROVIDER_ID)).toBe(true);
    expect(isProviderKeyOptional("deepseek")).toBe(false);
    expect(isProviderKeyOptional(undefined)).toBe(false);
  });
});
