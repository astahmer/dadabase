/**
 * Dadabase stores one flat thread per conversation, while the shared runtime
 * names the conversation-level identifier `sessionId`.
 */
export const resolveChatThreadId = ({
  sessionId,
  threadId,
}: {
  sessionId?: string;
  threadId?: string;
}): string | undefined => threadId ?? sessionId;
