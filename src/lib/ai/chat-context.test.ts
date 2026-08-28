import { describe, expect, it } from "vitest";

import {
  chatContextAttachmentKey,
  dataClassesForChatContext,
  sanitizeChatContextAttachments,
  serializeChatContextAttachments,
} from "./chat-context.ts";
import { DEFAULT_CHAT_DATA_ACCESS } from "./chat-data-access.ts";

describe("chat context attachments", () => {
  it("removes selected row values until sample-row access is enabled", () => {
    const attachments = sanitizeChatContextAttachments(
      [
        {
          kind: "selection",
          schema: "public",
          table: "users",
          columns: ["id", "email"],
          rowIds: ["1"],
          rows: [{ id: 1, email: "user@example.com" }],
        },
      ],
      DEFAULT_CHAT_DATA_ACCESS,
    );

    expect(attachments).toEqual([
      {
        kind: "selection",
        schema: "public",
        table: "users",
        columns: ["id", "email"],
        rowIds: ["1"],
      },
    ]);
  });

  it("keeps result rows only with query-result access and serializes deterministically", () => {
    const attachments = sanitizeChatContextAttachments(
      [{ kind: "result", columns: ["count"], rowCount: 1, rows: [{ count: 3 }] }],
      { ...DEFAULT_CHAT_DATA_ACCESS, queryResults: true },
    );

    expect(attachments[0]).toEqual({
      kind: "result",
      columns: ["count"],
      rowCount: 1,
      rows: [{ count: 3 }],
    });
    expect(dataClassesForChatContext(attachments)).toEqual(["query-results"]);
    expect(serializeChatContextAttachments(attachments)).toContain('"count":3');
  });

  it("uses the same removal key before and after sanitization", () => {
    const raw = { kind: "table" as const, schema: "main", table: "users" };
    const sanitized = sanitizeChatContextAttachments([raw], DEFAULT_CHAT_DATA_ACCESS)[0];

    expect(sanitized).toBeDefined();
    expect(chatContextAttachmentKey(raw)).toBe(chatContextAttachmentKey(sanitized!));
  });
});
