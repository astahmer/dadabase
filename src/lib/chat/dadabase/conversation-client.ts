// ConversationClient adapter for dadabase: backs the vendored chat runtime's
// persistence seam with thread CRUD server fns instead of REST endpoints.
// Flat model: a chat_threads row IS both the conversation and its only thread.
import type { ChatMessageSummary, ChatThreadSummary } from "#src/server/chat/chat-thread.start.ts";

import {
  deleteChatThreadServerFn,
  getChatThreadMessagesServerFn,
  listChatThreadsServerFn,
  updateChatThreadServerFn,
} from "#src/server/chat/chat-thread.start.ts";

import type { ChatMessage } from "../protocol/messages.ts";
import type { MemorySummary } from "../protocol/resources.ts";
import type {
  ConversationClient,
  LoadedChatHistory,
  Memory,
} from "../web/chat-runtime/conversation-client.ts";

import { collapseCompactedMessages } from "../chat/message-collapse.ts";
import { ChatContextReceiptSchema, MessageUsageSchema } from "../protocol/messages.ts";
import { MessagePartSchema, type MessagePart } from "../protocol/parts.ts";

const toConversation = (thread: ChatThreadSummary) => ({
  id: thread.conversationId,
  title: thread.title ?? "New chat",
  status: thread.status,
  pinned: thread.pinned,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  ...(thread.searchText === undefined ? {} : { searchText: thread.searchText }),
});

const toThread = (thread: ChatThreadSummary) => ({
  id: thread.id,
  conversationId: thread.conversationId,
  anchorMessageId: thread.anchorMessageId === "" ? crypto.randomUUID() : thread.anchorMessageId,
  title: thread.title,
  // Thread status enum differs from conversation status in the protocol.
  status: "regular" as const,
  pinned: thread.pinned,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
});

const decodeMessages = async (
  summaries: ReadonlyArray<ChatMessageSummary>,
): Promise<{ messages: ChatMessage[]; skippedCount: number }> => {
  const collapsed = collapseCompactedMessages(
    summaries.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
      createdAt: message.createdAt,
      ...(message.model === null ? {} : { model: message.model }),
      ...(message.usage === null || message.usage === undefined
        ? {}
        : MessageUsageSchema.safeParse(message.usage).success === true
          ? { usage: MessageUsageSchema.parse(message.usage) }
          : {}),
      ...(message.context === null || message.context === undefined
        ? {}
        : ChatContextReceiptSchema.safeParse(message.context).success === true
          ? { context: ChatContextReceiptSchema.parse(message.context) }
          : {}),
    })),
  );
  const decoded = await Promise.all(
    collapsed.map(async (message): Promise<ChatMessage | undefined> => {
      try {
        const parsed = MessagePartSchema.array().safeParse(JSON.parse(message.parts));
        if (!parsed.success) return undefined;
        const parts: Array<MessagePart> = parsed.data;
        return {
          id: message.id,
          role: message.role as ChatMessage["role"],
          parts,
          createdAt: message.createdAt,
          ...(message.model === undefined ? {} : { model: message.model }),
          ...("usage" in message && message.usage !== undefined ? { usage: message.usage } : {}),
          ...("context" in message && message.context !== undefined
            ? { context: message.context }
            : {}),
        };
      } catch {
        return undefined;
      }
    }),
  );
  const messages = decoded.filter((message): message is ChatMessage => message !== undefined);
  return { messages, skippedCount: decoded.length - messages.length };
};

/**
 * Build a ConversationClient over dadabase server fns.
 *
 * Memories, cloning, compaction and suggestions are not part of dadabase's
 * chat surface; they resolve to empty results or explicit failures and are
 * hidden via runtime `features` flags.
 */
export const createDadabaseConversationClient = ({
  connectionName,
}: {
  connectionName: string;
}): ConversationClient => ({
  listConversations: async () =>
    (await listChatThreadsServerFn({ data: connectionName })).map(toConversation),

  loadConversation: async ({ conversationId }): Promise<LoadedChatHistory> => {
    const result = await getChatThreadMessagesServerFn({
      data: { connectionName, threadId: conversationId },
    });
    const decodedMessages = await decodeMessages(result.messages);
    return {
      conversation: toConversation(result.thread),
      messages: decodedMessages.messages,
      ...(decodedMessages.skippedCount > 0
        ? {
            warning: `${decodedMessages.skippedCount} saved message${decodedMessages.skippedCount === 1 ? "" : "s"} could not be restored.`,
          }
        : {}),
    };
  },

  reviseConversationMessage: async () => {
    // Revisions land through the streaming route's turn persistence instead.
  },

  updateConversation: async ({ conversationId, patch }) => {
    const thread = await updateChatThreadServerFn({
      data: {
        connectionName,
        threadId: conversationId,
        patch: {
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.status === undefined ? {} : { status: patch.status }),
          ...(patch.pinned === undefined ? {} : { pinned: patch.pinned }),
        },
      },
    });
    return toConversation(thread);
  },

  deleteConversation: async ({ conversationId }) => {
    await deleteChatThreadServerFn({ data: { connectionName, threadId: conversationId } });
  },

  cloneConversation: async ({ conversationId }) => {
    throw new Error(`Cloning conversations is not supported (conversation ${conversationId}).`);
  },

  compactConversation: async ({ conversationId }) => {
    throw new Error(`Compacting conversations is not supported (conversation ${conversationId}).`);
  },

  listMemories: async () => [] as Memory[],
  loadMemorySummary: async () => undefined as MemorySummary | undefined,
  updateMemorySummary: async ({ content }) => ({
    content,
    memoryCount: 0,
    updatedAt: new Date(0).toISOString(),
  }),
  createMemory: async () => "",
  deleteMemory: async () => {},
  generateSuggestions: async () => [],

  listThreads: async ({ conversationId }) => {
    // Flat model: exactly one thread per conversation, itself.
    const result = await getChatThreadMessagesServerFn({
      data: { connectionName, threadId: conversationId },
    });
    return [toThread(result.thread)];
  },

  createThread: async ({ conversationId }) => {
    const result = await getChatThreadMessagesServerFn({
      data: { connectionName, threadId: conversationId },
    });
    return toThread(result.thread);
  },

  loadThread: async ({ conversationId }) => {
    const result = await getChatThreadMessagesServerFn({
      data: { connectionName, threadId: conversationId },
    });
    const decodedMessages = await decodeMessages(result.messages);
    return {
      thread: toThread(result.thread),
      messages: decodedMessages.messages,
      ...(decodedMessages.skippedCount > 0
        ? {
            warning: `${decodedMessages.skippedCount} saved message${decodedMessages.skippedCount === 1 ? "" : "s"} could not be restored.`,
          }
        : {}),
    };
  },
});
