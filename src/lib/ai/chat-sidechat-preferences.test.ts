import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_SIDECHAT_WIDTH_MAX,
  CHAT_SIDECHAT_WIDTH_MIN,
  getStoredChatSidechatWidth,
  setStoredChatSidechatWidth,
} from "./chat-sidechat-preferences.ts";

describe("chat sidechat width preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clamps persisted widths to the usable range", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: () => true,
    });
    setStoredChatSidechatWidth(CHAT_SIDECHAT_WIDTH_MAX + 200);
    expect(getStoredChatSidechatWidth()).toBe(CHAT_SIDECHAT_WIDTH_MAX);

    setStoredChatSidechatWidth(CHAT_SIDECHAT_WIDTH_MIN - 200);
    expect(getStoredChatSidechatWidth()).toBe(CHAT_SIDECHAT_WIDTH_MIN);
  });
});
