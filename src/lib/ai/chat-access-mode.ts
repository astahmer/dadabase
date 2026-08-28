export const CHAT_ACCESS_MODES = ["read-only", "read-write", "full"] as const;

export type ChatAccessMode = (typeof CHAT_ACCESS_MODES)[number];

export const DEFAULT_CHAT_ACCESS_MODE: ChatAccessMode = "read-only";

const storageKey = (connectionName: string): string =>
  `dadabase.chat.access-mode.${connectionName}`;

export const normalizeChatAccessMode = (value: unknown): ChatAccessMode =>
  value === "read-write" || value === "full" ? value : DEFAULT_CHAT_ACCESS_MODE;

export const getStoredChatAccessMode = (connectionName: string): ChatAccessMode => {
  if (typeof window === "undefined") return DEFAULT_CHAT_ACCESS_MODE;
  try {
    return normalizeChatAccessMode(window.localStorage.getItem(storageKey(connectionName)));
  } catch {
    return DEFAULT_CHAT_ACCESS_MODE;
  }
};

export const setStoredChatAccessMode = (connectionName: string, mode: ChatAccessMode): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(connectionName), mode);
  } catch {
    // Private mode/quota errors should not block the current chat session.
  }
};

export const chatAccessModeLabel = (mode: ChatAccessMode): string => {
  switch (mode) {
    case "read-write":
      return "Read & Write";
    case "full":
      return "Full Access";
    default:
      return "Read only";
  }
};

export const chatAccessModeDescription = (mode: ChatAccessMode): string => {
  switch (mode) {
    case "read-write":
      return "SELECT runs directly; INSERT and UPDATE always ask first.";
    case "full":
      return "SELECT runs directly; all writes, including DELETE, ask first.";
    default:
      return "SELECT queries run directly. Writes are blocked until you choose a broader mode.";
  }
};
