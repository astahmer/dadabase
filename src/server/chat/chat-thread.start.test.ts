import { describe, expect, it } from "vitest";

import { normalizePersistedMessageParts, persistedMessageSearchText } from "./chat-thread.start.ts";

describe("normalizePersistedMessageParts", () => {
  it("keeps the current single-encoded protocol payload unchanged", () => {
    const payload = JSON.stringify([{ type: "text", text: "hello" }]);
    expect(normalizePersistedMessageParts(payload)).toBe(payload);
  });

  it("unwraps legacy double-encoded protocol payloads", () => {
    const parts = [{ type: "text", text: "restored" }];
    expect(normalizePersistedMessageParts(JSON.stringify(JSON.stringify(parts)))).toBe(
      JSON.stringify(parts),
    );
  });
});

describe("persistedMessageSearchText", () => {
  it("indexes message text and SQL while ignoring metadata", () => {
    expect(
      persistedMessageSearchText(
        JSON.stringify([
          { type: "text", text: "find the fastest channel" },
          { type: "tool-run", input: { sql: "SELECT display_name FROM youtube_channel" } },
          { type: "tool-result", result: { requestId: "secret-implementation-detail" } },
        ]),
      ),
    ).toContain("find the fastest channel SELECT display_name FROM youtube_channel");
    expect(persistedMessageSearchText("{not valid json")).toBe("");
  });
});
