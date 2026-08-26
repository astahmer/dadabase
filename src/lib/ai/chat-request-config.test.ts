import { describe, expect, it } from "vitest";

import { ChatRequestConfigSchema } from "./chat-request-config.ts";

describe("ChatRequestConfigSchema", () => {
  it("accepts a full hosted-provider config", () => {
    const parsed = ChatRequestConfigSchema.parse({
      providerId: "openai",
      apiKey: "sk-test-key-1234567890",
      model: "gpt-4o-mini",
    });
    expect(parsed.providerId).toBe("openai");
    expect(parsed.baseUrl).toBeUndefined();
  });

  it("round-trips an explicit baseUrl (custom / proxied endpoint)", () => {
    const input = {
      providerId: "custom",
      baseUrl: "https://gateway.internal.example.com/v1",
      apiKey: "",
      model: "qwen2.5-coder:32b",
    };
    expect(ChatRequestConfigSchema.parse(input)).toEqual(input);
  });

  it("allows an empty apiKey for key-optional local providers", () => {
    const parsed = ChatRequestConfigSchema.parse({
      providerId: "ollama-local",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      model: "llama3.1",
    });
    expect(parsed.apiKey).toBe("");
  });

  it("rejects a missing providerId or model", () => {
    expect(() => ChatRequestConfigSchema.parse({ apiKey: "sk-x", model: "m" })).toThrow();
    expect(() => ChatRequestConfigSchema.parse({ providerId: "openai", apiKey: "sk-x" })).toThrow();
  });

  it("rejects a non-URL baseUrl", () => {
    expect(() =>
      ChatRequestConfigSchema.parse({
        providerId: "custom",
        baseUrl: "not a url",
        apiKey: "",
        model: "m",
      }),
    ).toThrow();
  });
});
