// Vendored from emi-healthfit @emi/core (protocol/messages.ts), adapted to zod.
import { z } from "zod";

import { MessageIdSchema, TimestampSchema } from "./ids.ts";
import { MessagePartSchema } from "./parts.ts";

export const MessageRoleSchema = z.enum(["user", "assistant", "system", "summary", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

const tokenCount = z.nullable(z.number().int().min(0));

export const MessageUsageSchema = z.object({
  promptTokens: tokenCount,
  completionTokens: tokenCount,
  totalTokens: tokenCount,
});
export type MessageUsage = z.infer<typeof MessageUsageSchema>;

/** Audit T1/T2: what a turn actually sent — schema mode, table subset, tools. */
export const ChatContextReceiptSchema = z.object({
  mode: z.enum(["all", "selected", "auto"]),
  tables: z.array(z.string()),
  tools: z.array(z.string()),
});
export type ChatContextReceipt = z.infer<typeof ChatContextReceiptSchema>;

const chatMessageFields = {
  id: MessageIdSchema,
  role: MessageRoleSchema,
  parts: z.array(MessagePartSchema),
  createdAt: TimestampSchema,
  model: z.optional(z.string()),
  usage: z.optional(MessageUsageSchema),
  context: z.optional(ChatContextReceiptSchema),
};

export const ChatMessageSchema = z.object(chatMessageFields);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatMessageDtoSchema = z.object(chatMessageFields);
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;
