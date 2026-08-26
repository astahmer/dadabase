/**
 * Tracks the conversation id the backend assigned to the active chat turn
 * (audit S8). The vendored runtime keeps it behind xstate internals, but the
 * SSE response already carries it in the `x-conversation-id` header — mirror
 * it here so host UI (e.g. editor back-links) can reference the thread
 * without reaching into the runtime.
 */
const CHAT_CONVERSATION_RESOLVED_EVENT = "dadabase:chat-conversation-resolved";

let currentConversationId: string | undefined;

export const recordCurrentChatConversationId = (conversationId: string): void => {
  if (conversationId === "") return;
  currentConversationId = conversationId;
  window.dispatchEvent(new Event(CHAT_CONVERSATION_RESOLVED_EVENT));
};

export const getCurrentChatConversationId = (): string | undefined => currentConversationId;

export const CHAT_CONVERSATION_RESOLVED = CHAT_CONVERSATION_RESOLVED_EVENT;
