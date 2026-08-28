// Vendored from emi-healthfit @emi/core (protocol/messages.ts), adapted to zod.
import { z } from "zod";

import { MessageIdSchema, TimestampSchema } from "./ids.ts";
import { MessagePartSchema } from "./parts.ts";

const ChatContextAttachmentReceiptSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("table"), schema: z.string().optional(), table: z.string() }),
  z.object({
    kind: z.literal("filters"),
    schema: z.string().optional(),
    table: z.string(),
    filterCount: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("selection"),
    schema: z.string().optional(),
    table: z.string(),
    columns: z.array(z.string()),
    rowCount: z.number().int().min(0),
    rowIdsCount: z.number().int().min(0),
    valuesShared: z.boolean(),
  }),
  z.object({
    kind: z.literal("sql"),
    source: z.enum(["editor", "result", "assistant"]),
    characterCount: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("result"),
    columns: z.array(z.string()),
    rowCount: z.number().int().min(0),
    valuesShared: z.boolean(),
  }),
]);

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
  dataClasses: z.array(z.enum(["schema", "sample-rows", "query-results"])).default(["schema"]),
  attachments: z.array(ChatContextAttachmentReceiptSchema).default([]),
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
