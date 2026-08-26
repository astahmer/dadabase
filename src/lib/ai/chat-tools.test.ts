import { describe, expect, it } from "vitest";

import {
  CHAT_TOOLS,
  CHAT_TOOL_IDS,
  DEFAULT_ENABLED_CHAT_TOOLS,
  isChatToolId,
  normalizeEnabledChatTools,
} from "./chat-tools.ts";

describe("chat-tools registry", () => {
  it("exposes propose_sql and run_sql with labels", () => {
    expect(CHAT_TOOL_IDS).toEqual(["propose_sql", "run_sql"]);
    for (const tool of CHAT_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("defaults to all tools enabled", () => {
    expect(DEFAULT_ENABLED_CHAT_TOOLS).toEqual(CHAT_TOOL_IDS);
  });
});

describe("normalizeEnabledChatTools", () => {
  it("returns all tools when nothing is stored", () => {
    expect(normalizeEnabledChatTools(undefined)).toEqual(["propose_sql", "run_sql"]);
  });

  it("preserves an explicit empty selection (select none)", () => {
    expect(normalizeEnabledChatTools([])).toEqual([]);
  });

  it("drops unknown ids", () => {
    expect(normalizeEnabledChatTools(["propose_sql", "bogus_tool"])).toEqual(["propose_sql"]);
  });

  it("collapses duplicates and returns canonical order regardless of input order", () => {
    expect(normalizeEnabledChatTools(["run_sql", "run_sql", "propose_sql"])).toEqual([
      "propose_sql",
      "run_sql",
    ]);
  });

  it("isChatToolId guards unknown values", () => {
    expect(isChatToolId("propose_sql")).toBe(true);
    expect(isChatToolId("nope")).toBe(false);
    expect(isChatToolId(42)).toBe(false);
  });
});
