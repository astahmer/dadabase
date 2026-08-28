/**
 * Tracks the conversation id the backend assigned to the active chat turn
 * (audit S8). The vendored runtime keeps it behind xstate internals, but the
 * SSE response already carries it in the `x-conversation-id` header — mirror
 * it here so host UI (e.g. editor back-links) can reference the thread
 * without reaching into the runtime.
 */
const CHAT_CONVERSATION_RESOLVED_EVENT = "dadabase:chat-conversation-resolved";

let currentConversationId: string | undefined;
const conversationIdsByConnection = new Map<string, string>();

export const recordCurrentChatConversationId = (
  conversationId: string,
  connectionName?: string,
): void => {
  if (conversationId === "") return;
  currentConversationId = conversationId;
  if (connectionName !== undefined) conversationIdsByConnection.set(connectionName, conversationId);
  window.dispatchEvent(new Event(CHAT_CONVERSATION_RESOLVED_EVENT));
};

export const getCurrentChatConversationId = (connectionName?: string): string | undefined =>
  (connectionName === undefined ? undefined : conversationIdsByConnection.get(connectionName)) ??
  currentConversationId;

export const CHAT_CONVERSATION_RESOLVED = CHAT_CONVERSATION_RESOLVED_EVENT;
