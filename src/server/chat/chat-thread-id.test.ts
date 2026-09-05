import { describe, expect, it } from "vitest";

import { resolveChatThreadId } from "./chat-thread-id.ts";

describe("resolveChatThreadId", () => {
  it("uses the explicit thread id when a runtime provides one", () => {
    expect(resolveChatThreadId({ sessionId: "conversation-1", threadId: "thread-1" })).toBe(
      "thread-1",
    );
  });

  it("maps a flat conversation session id to its persisted thread", () => {
    expect(resolveChatThreadId({ sessionId: "conversation-1" })).toBe("conversation-1");
  });
});
