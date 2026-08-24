import { describe, expect, it } from "vitest";

import {
  getOrphanUserMessageId,
  getProviderMessages,
  isDuplicateOrphanRetry,
} from "#src/lib/chat/chat/orphan-turn.ts";
import { collapseCompactedMessages } from "#src/lib/chat/chat/message-collapse.ts";

describe("vendored orphan-turn helpers", () => {
  it("detects a trailing user message as an orphan turn", () => {
    expect(
      getOrphanUserMessageId([
        { id: "a", role: "user" },
        { id: "b", role: "assistant" },
        { id: "c", role: "user" },
      ]),
    ).toBe("c");
    expect(getOrphanUserMessageId([{ id: "b", role: "assistant" }])).toBeNull();
    expect(getOrphanUserMessageId([])).toBeNull();
  });

  it("drops the orphaned turn when a new message arrives", () => {
    const existingRows = [
      { id: "a", role: "user" },
      { id: "b", role: "assistant" },
      { id: "c", role: "user" },
    ];
    const provider = getProviderMessages({
      existingRows,
      existingMessages: existingRows.map((row) => ({ ...row })),
      incomingMessages: [{ id: "d", role: "user" }],
      replaceMessageId: undefined,
    });
    expect(provider.map((message) => message.id)).toEqual(["a", "b", "d"]);
  });

  it("keeps history when replacing a message", () => {
    const rows = [
      { id: "a", role: "user" },
      { id: "c", role: "user" },
    ];
    const provider = getProviderMessages({
      existingRows: rows,
      existingMessages: rows.map((row) => ({ ...row })),
      incomingMessages: [{ id: "replacement", role: "assistant" }],
      replaceMessageId: "b",
    });
    expect(provider.map((message) => message.id)).toEqual(["a", "c", "replacement"]);
  });

  it("flags duplicate orphan retries by identical parts", () => {
    const userMessage = { id: "c", role: "user", parts: [{ type: "text", text: "again" }] };
    expect(
      isDuplicateOrphanRetry({
        existingRows: [userMessage],
        existingMessages: [userMessage],
        incomingMessages: [{ ...userMessage, id: "c2" }],
      }),
    ).toBe(true);
    expect(
      isDuplicateOrphanRetry({
        existingRows: [userMessage],
        existingMessages: [userMessage],
        incomingMessages: [{ ...userMessage, parts: [{ type: "text", text: "different" }] }],
      }),
    ).toBe(false);
  });
});

describe("vendored message-collapse helper", () => {
  const build = (overrides: Array<{ id: string; role?: string; createdAt?: string; parentId?: string | null }>) =>
    overrides.map((entry) => ({
      id: entry.id,
      role: entry.role ?? "user",
      createdAt: entry.createdAt ?? `2026-08-02T00:00:0${entry.id}.000Z`,
      parentId: entry.parentId ?? null,
    }));

  it("returns messages untouched without a summary marker", () => {
    const messages = build([{ id: "1" }, { id: "2", role: "assistant" }]);
    expect(collapseCompactedMessages(messages)).toHaveLength(2);
  });

  it("collapses everything before the newest summary marker", () => {
    const messages = [
      ...build([{ id: "1" }, { id: "2", role: "assistant" }]),
      ...build([{ id: "3", role: "summary" }, { id: "4" }]),
      ...build([{ id: "5", role: "assistant" }]),
    ];
    const collapsed = collapseCompactedMessages(messages);
    expect(collapsed.map((message) => message.id)).toEqual(["3", "4", "5"]);
  });
});
