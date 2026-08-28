import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAT_ACCESS_MODE,
  chatAccessModeDescription,
  chatAccessModeLabel,
  normalizeChatAccessMode,
} from "./chat-access-mode.ts";

describe("chat access mode", () => {
  it("defaults to read-only for missing or unknown values", () => {
    expect(normalizeChatAccessMode(undefined)).toBe(DEFAULT_CHAT_ACCESS_MODE);
    expect(normalizeChatAccessMode("admin")).toBe(DEFAULT_CHAT_ACCESS_MODE);
  });

  it("has clear labels and safety copy", () => {
    expect(chatAccessModeLabel("read-write")).toBe("Read & Write");
    expect(chatAccessModeLabel("full")).toBe("Full Access");
    expect(chatAccessModeDescription("read-only")).toMatch(/SELECT queries run directly/i);
    expect(chatAccessModeDescription("full")).toMatch(/DELETE/i);
  });
});
