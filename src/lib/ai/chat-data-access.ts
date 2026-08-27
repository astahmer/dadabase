import type { ChatToolId } from "./chat-tools.ts";

export const CHAT_DATA_CLASSES = ["schema", "sample-rows", "query-results"] as const;

export type ChatDataClass = (typeof CHAT_DATA_CLASSES)[number];

export interface ChatDataAccess {
  schema: boolean;
  sampleRows: boolean;
  queryResults: boolean;
}

export const DEFAULT_CHAT_DATA_ACCESS: ChatDataAccess = {
  schema: true,
  sampleRows: false,
  queryResults: false,
};

const storageKey = (connectionName: string): string =>
  `dadabase.chat.data-access.${connectionName}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const normalizeChatDataAccess = (value: unknown): ChatDataAccess => {
  if (!isRecord(value)) return { ...DEFAULT_CHAT_DATA_ACCESS };
  return {
    schema: value.schema !== false,
    sampleRows: value.sampleRows === true,
    queryResults: value.queryResults === true,
  };
};

export const getStoredChatDataAccess = (connectionName: string): ChatDataAccess => {
  if (typeof window === "undefined") return { ...DEFAULT_CHAT_DATA_ACCESS };
  try {
    const raw = window.localStorage.getItem(storageKey(connectionName));
    return raw === null
      ? { ...DEFAULT_CHAT_DATA_ACCESS }
      : normalizeChatDataAccess(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CHAT_DATA_ACCESS };
  }
};

export const setStoredChatDataAccess = (connectionName: string, access: ChatDataAccess): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(connectionName),
      JSON.stringify(normalizeChatDataAccess(access)),
    );
  } catch {
    // Private mode/quota errors should not block chat in the current session.
  }
};

/** Row-returning tools are opt-in even when a user enabled the tool itself. */
export const applyChatDataAccessToTools = (
  enabledTools: readonly ChatToolId[],
  access: ChatDataAccess,
): ChatToolId[] =>
  enabledTools.filter(
    (tool) =>
      (tool !== "preview_rows" || access.sampleRows) && (tool !== "run_sql" || access.queryResults),
  );

export const dataClassesForChatTurn = (input: {
  hasSchema: boolean;
  enabledTools: readonly ChatToolId[];
}): ChatDataClass[] => [
  ...(input.hasSchema ? (["schema"] as const) : []),
  ...(input.enabledTools.includes("preview_rows") ? (["sample-rows"] as const) : []),
  ...(input.enabledTools.includes("run_sql") ? (["query-results"] as const) : []),
];
