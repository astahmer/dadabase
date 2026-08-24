import type { UIMessage } from "ai";

import { describe, expect, it } from "vitest";

import { ChatMessageSchema } from "../protocol/messages.ts";
import {
  APPROVAL_EXTENSION_NAME,
  APPROVAL_EXTENSION_NAMESPACE,
  APPROVAL_EXTENSION_NAMESPACE as NAMESPACE,
  ChatUiMessages,
  ChatUiMessagesError,
  findPendingApproval,
  hasPendingApproval,
} from "./ui-messages.ts";

type UiPart = UIMessage["parts"][number];

const dynamicToolPart = (overrides: Partial<Record<string, unknown>>): UiPart =>
  ({
    type: "dynamic-tool",
    toolName: "run_sql",
    toolCallId: "call-1",
    state: "input-available",
    input: {},
    ...overrides,
  }) as unknown as UiPart;

/** Build a protocol ChatMessage by running ui parts through the real mapper. */
const protocolMessageWith = (
  id: string,
  parts: ReadonlyArray<UiPart>,
): ReturnType<typeof ChatMessageSchema.parse> =>
  ChatMessageSchema.parse({
    id,
    role: "assistant",
    createdAt: "2026-08-24T00:00:00.000Z",
    parts: ChatUiMessages.toProtocolParts({ parts }),
  });

const assistantMessageWith = (approvalId: string) =>
  protocolMessageWith("assistant-1", [
    dynamicToolPart({
      state: "approval-requested",
      approval: { id: approvalId },
      input: { sql: "DELETE FROM users" },
    }),
  ]);

describe("ChatUiMessages.toProtocolParts — ui part mapping", () => {
  it("maps text, reasoning and skips step-start markers", () => {
    const parts = ChatUiMessages.toProtocolParts({
      parts: [
        { type: "step-start" },
        { type: "text", text: "hello" } as UiPart,
        { type: "reasoning", text: "thinking…" } as UiPart,
      ],
    });
    expect(parts).toEqual([
      { type: "text", text: "hello" },
      { type: "reasoning", text: "thinking…" },
    ]);
  });

  it("maps tool-invocation states to protocol tool-invocation parts", () => {
    const parts = ChatUiMessages.toProtocolParts({
      parts: [
        dynamicToolPart({ state: "input-available", input: { sql: "SELECT 1" } }),
        dynamicToolPart({ toolCallId: "call-2", state: "output-available", output: { rows: [] } }),
        dynamicToolPart({ toolCallId: "call-3", state: "output-error", errorText: "boom" }),
        dynamicToolPart({ toolCallId: "call-4", state: "output-denied", approval: {} }),
      ],
    });

    expect(parts[0]).toMatchObject({
      type: "tool-invocation",
      toolName: "run_sql",
      toolCallId: "call-1",
      state: "input-available",
      input: { sql: "SELECT 1" },
    });
    expect(parts[1]).toMatchObject({ toolCallId: "call-2", state: "output-available" });
    expect(parts[2]).toMatchObject({
      toolCallId: "call-3",
      state: "output-error",
      errorText: "boom",
    });
    // denied maps onto output-error with the fallback reason
    expect(parts[3]).toMatchObject({ toolCallId: "call-4", state: "output-error" });
    expect((parts[3] as { errorText: string }).errorText).toBe("Tool invocation denied.");
  });

  it("falls back to the tool name embedded in the part type", () => {
    const parts = ChatUiMessages.toProtocolParts({
      parts: [
        { type: "tool-run_sql", toolCallId: "c9", state: "input-available", input: {} } as UiPart,
      ],
    });
    expect(parts[0]).toMatchObject({ toolName: "run_sql" });
  });
});

describe("ChatUiMessages — approval round-trip", () => {
  it("surfaces an approval-requested tool part as a pending tool-approval extension part", () => {
    const [part] = ChatUiMessages.toProtocolParts({
      parts: [dynamicToolPart({ state: "approval-requested", approval: { id: "appr-1" } })],
    });

    expect(part).toMatchObject({
      type: "extension",
      namespace: APPROVAL_EXTENSION_NAMESPACE,
      name: APPROVAL_EXTENSION_NAME,
    });

    const message = ChatMessageSchema.parse({
      id: "m1",
      role: "assistant",
      createdAt: "2026-08-24T00:00:00.000Z",
      parts: [part],
    });
    expect(findPendingApproval(message)).toMatchObject({
      approvalId: "appr-1",
      toolName: "run_sql",
      toolCallId: "call-1",
    });
    expect(hasPendingApproval([message])).toBe(true);
  });

  it("toWireMessages reconstructs the approval-requested dynamic-tool part", () => {
    const extensionPart = ChatUiMessages.toProtocolParts({
      parts: [dynamicToolPart({ state: "approval-requested", approval: { id: "appr-1" } })],
    })[0];
    const message = ChatMessageSchema.parse({
      id: "m1",
      role: "assistant",
      createdAt: "2026-08-24T00:00:00.000Z",
      parts: [extensionPart],
    });

    const wire = ChatUiMessages.toWireMessages({ messages: [message] });
    expect(wire[0]?.parts[0]).toMatchObject({
      type: "dynamic-tool",
      state: "approval-requested",
      approval: { id: "appr-1" },
      toolName: "run_sql",
    });
  });

  it("an approve decision flips the wire part to approval-responded with approved=true", () => {
    const wire = ChatUiMessages.toWireMessages({
      messages: [
        {
          id: "u1",
          role: "user",
          createdAt: "2026-08-24T00:00:00.000Z",
          parts: [{ type: "text", text: "delete all" }],
        },
        assistantMessageWith("appr-1"),
      ],
      approvalDecision: { approvalId: "appr-1", approved: true },
    });

    const lastAssistant = wire.at(-1);
    expect(lastAssistant?.role).toBe("assistant");
    const responded = lastAssistant?.parts.find(
      (part) => "state" in part && part.state === "approval-responded",
    ) as { approval?: { id: string; approved?: boolean; reason?: string } } | undefined;
    expect(responded?.approval).toEqual({ id: "appr-1", approved: true });
  });

  it("a reject decision carries a denial reason and no approved flag", () => {
    const wire = ChatUiMessages.toWireMessages({
      messages: [assistantMessageWith("appr-2")],
      approvalDecision: { approvalId: "appr-2", approved: false },
    });

    const responded = wire[0]?.parts[0] as unknown as {
      state: string;
      approval: { approved?: boolean; reason?: string };
    };
    expect(responded.state).toBe("approval-responded");
    expect(responded.approval.approved).toBe(false);
    expect(responded.approval.reason).toBe("Denied by user.");
  });

  it("only the matching approvalId is flipped; other pending approvals stay armed", () => {
    const twoPending = protocolMessageWith("a1", [
      dynamicToolPart({
        toolCallId: "ca",
        state: "approval-requested",
        approval: { id: "appr-a" },
      }),
      dynamicToolPart({
        toolCallId: "cb",
        state: "approval-requested",
        approval: { id: "appr-b" },
      }),
    ]);
    const wire = ChatUiMessages.toWireMessages({
      messages: [twoPending],
      approvalDecision: { approvalId: "appr-b", approved: true },
    });

    const states = wire[0]?.parts.map((part) => ("state" in part ? part.state : ""));
    expect(states).toEqual(["approval-requested", "approval-responded"]);
  });

  it("the transient approval-responded ui state keeps showing the pending extension until results land", () => {
    const parts = ChatUiMessages.toProtocolParts({
      parts: [
        dynamicToolPart({
          state: "approval-responded",
          approval: { id: "appr-1", approved: true },
        }),
      ],
    });
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "extension",
      namespace: NAMESPACE,
      name: APPROVAL_EXTENSION_NAME,
    });
  });
});

describe("ChatUiMessages — malformed / unknown shapes degrade without throwing", () => {
  it("findPendingApproval ignores malformed extension data", () => {
    const message = ChatMessageSchema.parse({
      id: "m1",
      role: "assistant",
      createdAt: "2026-08-24T00:00:00.000Z",
      parts: [
        {
          type: "extension",
          namespace: APPROVAL_EXTENSION_NAMESPACE,
          name: APPROVAL_EXTENSION_NAME,
          data: { approvalId: "" }, // missing toolCallId/toolName, empty id
        },
      ],
    });
    expect(findPendingApproval(message)).toBeUndefined();
    expect(hasPendingApproval([message])).toBe(false);
    expect(findPendingApproval(undefined)).toBeUndefined();
  });

  it("toUiMessage silently drops malformed approval extensions instead of throwing", () => {
    const message = ChatMessageSchema.parse({
      id: "m1",
      role: "assistant",
      createdAt: "2026-08-24T00:00:00.000Z",
      parts: [
        {
          type: "extension",
          namespace: APPROVAL_EXTENSION_NAMESPACE,
          name: APPROVAL_EXTENSION_NAME,
          data: { nope: true },
        },
      ],
    });
    const wire = ChatUiMessages.toWireMessages({ messages: [message] });
    expect(wire[0]?.parts).toHaveLength(0);
  });

  it("unknown non-tool part types raise the typed mapping error, not a raw crash", () => {
    try {
      ChatUiMessages.toProtocolParts({ parts: [{ type: "source-url" } as UiPart] });
      expect.unreachable("expected ChatUiMessagesError");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatUiMessagesError);
      expect((error as ChatUiMessagesError).code).toBe("unsupported-ui-message-part");
    }
  });

  it("unmapped tool states raise the typed unsupported-tool-state error", () => {
    try {
      ChatUiMessages.toProtocolParts({
        parts: [dynamicToolPart({ state: "quantum-superposition" })],
      });
      expect.unreachable("expected ChatUiMessagesError");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatUiMessagesError);
      expect((error as ChatUiMessagesError).code).toBe("unsupported-tool-state");
    }
  });

  it("an approval request missing its id raises invalid-approval-request", () => {
    try {
      ChatUiMessages.toProtocolParts({
        parts: [dynamicToolPart({ state: "approval-requested", approval: undefined })],
      });
      expect.unreachable("expected ChatUiMessagesError");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatUiMessagesError);
      expect((error as ChatUiMessagesError).code).toBe("invalid-approval-request");
    }
  });
});
