import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_SIDECHAT_WIDTH_MIN,
  getStoredChatSidechatWidth,
  setStoredChatSidechatWidth,
} from "./chat-sidechat-preferences.ts";

describe("chat sidechat width preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps large persisted widths available for wide workspaces", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: () => true,
    });
    setStoredChatSidechatWidth(2400);
    expect(getStoredChatSidechatWidth()).toBe(2400);

    setStoredChatSidechatWidth(CHAT_SIDECHAT_WIDTH_MIN - 200);
    expect(getStoredChatSidechatWidth()).toBe(CHAT_SIDECHAT_WIDTH_MIN);
  });
});
