import { describe, expect, it } from "vitest";

import { ErrorResponseDtoSchema } from "#src/lib/chat/protocol/errors.ts";
import { ChatProtocol, parseProtocol } from "#src/lib/chat/protocol/mappers.ts";
import { ChatMessageSchema } from "#src/lib/chat/protocol/messages.ts";
import { GenerationEventSchema } from "#src/lib/chat/protocol/model.ts";
import { MessagePartSchema } from "#src/lib/chat/protocol/parts.ts";

const toolCall = {
  type: "tool-call" as const,
  call: { id: "call-1", name: "lookup", input: { query: "Paris" } },
};

const toolResult = {
  type: "tool-result" as const,
  result: { callId: "call-1", output: { city: "Paris" }, isError: false },
};

const toolInvocation = {
  type: "tool-invocation" as const,
  toolName: "lookup",
  toolCallId: "call-1",
  state: "output-available" as const,
  input: { query: "Paris" },
  output: { city: "Paris" },
};

const validMessage = {
  id: "message-1",
  role: "assistant" as const,
  parts: [{ type: "text" as const, text: "Hello" }, toolCall, toolResult, toolInvocation],
  createdAt: "2026-08-02T00:00:00.000Z",
};

describe("vendored chat protocol", () => {
  it("round-trips a chat message through the DTO mappers", async () => {
    const dto = await ChatProtocol.runPromise(ChatProtocol.toChatMessageDto(validMessage));
    expect(dto).toEqual(validMessage);
    const decoded = await ChatProtocol.runPromise(ChatProtocol.fromChatMessageDto(dto));
    expect(decoded).toEqual(validMessage);
  });

  it("preserves optional model and usage fields on copy", async () => {
    const withMeta = {
      ...validMessage,
      model: "gpt-4o-mini",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };
    const dto = await ChatProtocol.runPromise(ChatProtocol.toChatMessageDto(withMeta));
    expect(dto.model).toBe("gpt-4o-mini");
    expect(dto.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("keeps every part-type variant of the union decodable", () => {
    for (const part of [
      { type: "text", text: "hi" },
      { type: "reasoning", text: "thinking" },
      {
        type: "file",
        file: {
          id: "attachment-1",
          name: "notes.txt",
          mediaType: "text/plain",
          url: "/api/attachments/attachment-1",
          size: 5,
        },
      },
      toolCall,
      toolResult,
      toolInvocation,
    ]) {
      expect(MessagePartSchema.safeParse(part).success).toBe(true);
    }
    // Unsafe attachment URLs are rejected by the protocol.
    expect(
      MessagePartSchema.safeParse({
        type: "file",
        file: {
          id: "attachment-1",
          name: "evil.txt",
          mediaType: "text/plain",
          url: "//evil.example/attachment",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed messages and surfaces ProtocolDecodeError", async () => {
    const effect = ChatProtocol.fromChatMessageDto({ ...validMessage, id: "" });
    await expect(ChatProtocol.runPromise(effect)).rejects.toMatchObject({
      _tag: "ProtocolDecodeError",
    });
  });

  it("decodes transport error responses and generation events", () => {
    expect(
      ErrorResponseDtoSchema.safeParse({
        error: { code: "rate_limited", message: "slow down", retryable: true },
      }).success,
    ).toBe(true);

    expect(
      GenerationEventSchema.safeParse({
        type: "completed",
        message: validMessage,
      }).success,
    ).toBe(true);
    expect(GenerationEventSchema.safeParse({ type: "exploded" }).success).toBe(false);
  });

  it("validates message shape via the shared schema", () => {
    expect(ChatMessageSchema.safeParse(validMessage).success).toBe(true);
    expect(parseProtocol(ChatMessageSchema, validMessage) !== undefined).toBe(true);
  });
});
